#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";

import { WaybackMachineDownloader } from "./lib/downloader.js";

const START_URL = "http://www.cdc.gov/brfss/";
const ARCHIVE_ROOT = "https://web.archive.org";
const DEFAULT_OUTPUT = path.resolve("brfss-data");
const DEFAULT_MAX_PAGES = 1000;
const DEFAULT_MAX_DEPTH = 10;

const downloadableExtensions = new Set([
  ".7z", ".csv", ".dat", ".dbf", ".dta", ".gz", ".mdb", ".pdf", ".sav",
  ".sas", ".sas7bdat", ".sps", ".txt", ".zip",
]);

function parseArgs(argv) {
  const options = {
    startUrl: START_URL,
    output: DEFAULT_OUTPUT,
    maxPages: DEFAULT_MAX_PAGES,
    maxDepth: DEFAULT_MAX_DEPTH,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--start-url") options.startUrl = argv[++i];
    else if (arg === "--output") options.output = path.resolve(argv[++i]);
    else if (arg === "--max-pages") options.maxPages = Number(argv[++i]);
    else if (arg === "--max-depth") options.maxDepth = Number(argv[++i]);
    else if (arg === "--help") {
      console.log(
        "Usage: node brfss-scraper.js [--start-url URL] [--output DIRECTORY] " +
        "[--max-pages N] [--max-depth N]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.startUrl || !Number.isInteger(options.maxPages) || options.maxPages < 1) {
    throw new Error("--start-url and --max-pages must be valid");
  }
  if (!Number.isInteger(options.maxDepth) || options.maxDepth < 0) {
    throw new Error("--max-depth must be a non-negative integer");
  }
  return options;
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function csvRow(values) {
  return values.map(csvCell).join(",");
}

function isSameSite(url, startUrl) {
  const candidate = new URL(url);
  const start = new URL(startUrl);
  const candidateHost = candidate.hostname.toLowerCase().replace(/^www\./, "");
  const startHost = start.hostname.toLowerCase().replace(/^www\./, "");
  return candidateHost === startHost && candidate.pathname.toLowerCase().startsWith("/brfss");
}

function normalizeOriginalUrl(href, pageUrl, startUrl) {
  if (!href || /^(#|javascript:|mailto:|tel:|data:)/i.test(href.trim())) return null;

  try {
    const candidate = new URL(href, pageUrl);
    candidate.hash = "";
    if (!/^https?:$/i.test(candidate.protocol) || !isSameSite(candidate.href, startUrl)) {
      return null;
    }
    return candidate.href;
  } catch {
    return null;
  }
}

function isDownloadCandidate(url, anchorText = "") {
  const parsed = new URL(url);
  const extension = path.posix.extname(parsed.pathname).toLowerCase();
  if (downloadableExtensions.has(extension)) return true;
  if (!extension || [".html", ".htm", ".php", ".asp", ".aspx"].includes(extension)) return false;
  return /(download|survey|data|annual|ascii|sas|spss|stata|xpt)/i.test(
    `${parsed.pathname} ${parsed.search} ${anchorText}`,
  );
}

async function getSnapshots(originalUrl) {
  const endpoint = new URL("https://web.archive.org/cdx/search/cdx");
  endpoint.search = new URLSearchParams({
    url: originalUrl,
    output: "json",
    fl: "timestamp,original,statuscode,mimetype",
    filter: "statuscode:200",
    collapse: "digest",
    sort: "timestamp",
    from: "1990",
    to: "2026",
  });

  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`CDX request failed (${response.status}) for ${originalUrl}`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1)
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]])))
    .filter((snapshot) => snapshot.timestamp && snapshot.original)
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
}

async function fetchSnapshot(snapshot) {
  const archiveUrl = `${ARCHIVE_ROOT}/web/${snapshot.timestamp}id_/${snapshot.original}`;
  const response = await fetch(archiveUrl, { redirect: "follow" });
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") || "";
  if (!/html|text/i.test(contentType)) return null;
  return { archiveUrl, html: await response.text() };
}

async function writeCatalog(catalogPath, rows) {
  const header = [
    "source_page",
    "source_archive_url",
    "linked_url",
    "linked_archive_url",
    "relationship",
    "depth",
    "archived_at",
    "status",
  ];
  const content = [csvRow(header), ...rows.map((row) => csvRow(header.map((key) => row[key])))].join("\n");
  await fs.writeFile(catalogPath, `${content}\n`, "utf8");
}

async function downloadFile(downloader, snapshot, outputDirectory) {
  downloader.directory = path.join(outputDirectory, "snapshots", snapshot.timestamp);
  const fileId = new URL(snapshot.original).pathname || snapshot.original;
  const paths = downloader.assetManager.determinePaths(snapshot.original, fileId);
  if (!paths) return false;

  const existed = await fs.stat(paths.filePath).then(() => true).catch(() => false);
  downloader._processed = 0;
  await downloader._download_single(
    { file_url: snapshot.original, timestamp: snapshot.timestamp, file_id: fileId },
    1,
  );
  const downloaded = await fs.stat(paths.filePath).then(() => true).catch(() => false);
  if (downloaded && !existed) console.log(`Downloaded ${snapshot.original} (${snapshot.timestamp})`);
  return downloaded;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const startUrl = new URL(options.startUrl).href;
  await fs.mkdir(options.output, { recursive: true });

  const catalogPath = path.join(options.output, "brfss-pages.csv");
  const catalog = [];
  const queue = [{ url: startUrl, depth: 0, parent: "" }];
  const visited = new Set();
  const downloaded = new Set();
  const downloadParents = new Map();
  let processedSnapshots = 0;
  const downloader = new WaybackMachineDownloader({
    base_url: startUrl,
    exact_url: true,
    directory: options.output,
    rewrite_mode: "as-is",
    threads_count: 1,
  });

  while (queue.length > 0 && processedSnapshots < options.maxPages) {
    const current = queue.shift();
    if (visited.has(current.url) || current.depth > options.maxDepth) continue;
    visited.add(current.url);

    try {
      const snapshots = await getSnapshots(current.url);
      if (snapshots.length === 0) {
        catalog.push({
          source_page: current.parent,
          source_archive_url: "",
          linked_url: current.url,
          linked_archive_url: "",
          relationship: "page",
          depth: current.depth,
          archived_at: "",
          status: "no snapshot",
        });
        continue;
      }

      for (const snapshot of snapshots) {
        if (processedSnapshots >= options.maxPages) break;
        processedSnapshots += 1;
        const page = await fetchSnapshot(snapshot);
        if (!page) continue;

        catalog.push({
          source_page: current.parent || current.url,
          source_archive_url: page.archiveUrl,
          linked_url: current.url,
          linked_archive_url: page.archiveUrl,
          relationship: current.parent ? "followed page" : "start page",
          depth: current.depth,
          archived_at: snapshot.timestamp,
          status: "visited",
        });

        const $ = cheerio.load(page.html);
        $("a[href]").each((_index, element) => {
          const linkedUrl = normalizeOriginalUrl($(element).attr("href"), current.url, startUrl);
          if (!linkedUrl) return;
          const text = $(element).text().replace(/\s+/g, " ").trim();
          if (isDownloadCandidate(linkedUrl, text)) {
            if (!downloaded.has(linkedUrl)) {
              downloaded.add(linkedUrl);
              downloadParents.set(linkedUrl, current.url);
            }
            return;
          }
          if (!visited.has(linkedUrl) && current.depth < options.maxDepth) {
            queue.push({ url: linkedUrl, depth: current.depth + 1, parent: current.url });
          }
        });
      }
    } catch (error) {
      catalog.push({
        source_page: current.parent,
        source_archive_url: "",
        linked_url: current.url,
        linked_archive_url: "",
        relationship: "page",
        depth: current.depth,
        archived_at: "",
        status: `error: ${error.message}`,
      });
    }

    const pendingDownloads = [...downloaded].filter((url) => !visited.has(url));
    for (const fileUrl of pendingDownloads) {
      const fileSnapshots = await getSnapshots(fileUrl).catch(() => []);
      const sourcePage = downloadParents.get(fileUrl) || "";
      for (const fileSnapshot of fileSnapshots) {
        const didDownload = await downloadFile(downloader, fileSnapshot, options.output);
        catalog.push({
          source_page: sourcePage,
          source_archive_url: "",
          linked_url: fileUrl,
          linked_archive_url: `${ARCHIVE_ROOT}/web/${fileSnapshot.timestamp}id_/${fileSnapshot.original}`,
          relationship: "download",
          depth: current.depth + 1,
          archived_at: fileSnapshot.timestamp,
          status: didDownload ? "downloaded" : "not downloaded",
        });
      }
      visited.add(fileUrl);
    }
  }

  await writeCatalog(catalogPath, catalog);
  console.log(`Processed ${processedSnapshots} archived page points and ${downloaded.size} candidate files.`);
  console.log(`Catalog written to ${catalogPath}`);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  main().catch((error) => {
    console.error(`FATAL: ${error.stack || error}`);
    process.exitCode = 1;
  });
}

export { main };
