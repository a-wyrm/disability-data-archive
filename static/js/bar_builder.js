
(() => {
  // Find the chart controls and output container after the page has loaded
  const builder = document.querySelector('.graph-builder');

  // Store references to the controls used to select fields and build the chart
  const xSelect = builder.querySelector('#graph-x');
  const ySelect = builder.querySelector('#graph-y');
  const buildButton = builder.querySelector('#graph-build');
  const status = builder.querySelector('#graph-status');
  const output = builder.querySelector('#graph-output');

  // Parse CSV text into an array of rows while supporting quoted commas and newlines
  function parseCsv(input) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let index = 0; index < input.length; index += 1) {
      const character = input[index];
      if (quoted) {
        if (character === '"' && input[index + 1] === '"') {
          field += '"';
          index += 1;
        } 
        else if (character === '"') {
          quoted = false;
        }
        else {
          field += character;
        }
      } 
      else if (character === '"') {
        quoted = true;
      }
      else if (character === ',') {
        row.push(field);
        field = '';
      } 
      else if (character === '\n' || character === '\r') {
        if (character === '\r' && input[index + 1] === '\n') index += 1;
        row.push(field);
        if (row.some((value) => value.trim() !== '')) rows.push(row);
        row = [];
        field = '';
      } 
      else {
        field += character;
      }
    }
    if (field !== '' || row.length > 0) {
      row.push(field);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
    }
    return rows;
  }

  // Populate both field selectors from the CSV header row
  function setFields(headers) {
    const options = headers.map((header, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = header || `Column ${index + 1}`;
      return option;
    });

    xSelect.replaceChildren(...options.map((option) => option.cloneNode(true)));
    ySelect.replaceChildren(...options);
    xSelect.disabled = headers.length === 0;
    ySelect.disabled = headers.length === 0;
    buildButton.disabled = headers.length < 2;
  }

  function escapeSvgText(value) {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function renderBarChart(headers, rows) {
    // Read the selected columns and combine rows with the same x-axis label
    const xIndex = Number(xSelect.value);
    const yIndex = Number(ySelect.value);
    const grouped = new Map();
    let skipped = 0;

    rows.forEach((row) => {
      const label = (row[xIndex] ?? '').trim();
      const value = Number((row[yIndex] ?? '').replace(/[^0-9.+-]/g, ''));
      if (!label || !Number.isFinite(value)) {
        skipped += 1;
        return;
      }
      grouped.set(label, (grouped.get(label) ?? 0) + value);
    });

    // Limit very large charts to the first 100 grouped categories
    const values = [...grouped.entries()].slice(0, 100);
    if (values.length === 0) {

      // Tell the user when the selected y-axis field has no usable numbers
      output.innerHTML = '<p class="graph-message">The selected Y field does not contain numeric values.</p>';
      status.textContent = 'No chartable rows found.';
      return;
    }

    // Set the chart size and reserve space for axis labels and tick marks
    const width = Math.max(640, values.length * 72);
    const height = 360;
    const margin = { top: 20, right: 20, bottom: 70, left: 56 };
    const max = Math.max(...values.map(([, value]) => value), 0);
    const min = Math.min(...values.map(([, value]) => value), 0);

    // Map each category to a horizontal band for its bar and x-axis tick
    const xScale = d3.scaleBand()
    .domain(values.map(([label]) => label))
    .range([margin.left, width - margin.right])
    .padding(0.2);

    // Map numeric values to vertical positions, including zero for the baseline.
    const yScale = d3.scaleLinear()
    .domain([Math.min(min, 0), Math.max(max, 0)])
    .nice()
    .range([height - margin.bottom, margin.top]);

    // Create one SVG rectangle for each grouped category.
    const bars = values.map(([label, value]) => {

      const label_x = xScale(label);
      const zeroY = yScale(0);
      const valueY = yScale(value);
      const barHeight = Math.abs(zeroY - valueY);
      const safeLabel = escapeSvgText(label);
      return `<rect class="graph-bar" x="${label_x}" y="${Math.min(zeroY, valueY)}" width="${xScale.bandwidth()}" height="${Math.max(1, barHeight)}"><title>${safeLabel}: ${value}</title></rect>`;
    }).join('');



    // Insert the SVG and bars into the output container.
    output.innerHTML = `
    <div class="graph-frame">
      <button class="graph-zoom-out" type="button" aria-label="Zoom out on chart">Zoom out</button>
      <button class="graph-zoom-in" type="button" aria-label="Zoom in on chart">Zoom in</button>
      <div class="graph-scroll">
      <svg class="bar-chart" 
      viewBox="0 0 ${width} ${height}" 
      role="img" aria-label="Bar chart of ${escapeSvgText(headers[xIndex])} by ${escapeSvgText(headers[yIndex])}">
        <g class="chart-content">${bars}</g>
      </svg>
      </div>
    </div>`;
    // Report how many categories were charted and whether rows were skipped
    status.textContent = `${values.length} categories shown${grouped.size > 100 ? ' (first 100)' : ''}${skipped ? ` · ${skipped} rows skipped` : ''}.`;
    const svg = d3.select(output).select('svg');
    const chartContent = svg.select('.chart-content');

    // Draw x-axis ticks at the category positions and at the zero baseline
    chartContent.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${yScale(0)})`)
    .call(
      d3.axisBottom(xScale)
        .tickSizeOuter(0)
    );
    // Draw y-axis ticks using the numeric scale and chart margin
    chartContent.append('g')
    .attr('class', 'y-axis')
    .attr('transform', `translate(${margin.left}, 0)`)
    .call(
      d3.axisLeft(yScale)
        .ticks(6)
        .tickSizeOuter(0)
    );

    // Zoom and pan the bars and axes together with the mouse wheel, pinch, or drag.
    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on('zoom', (event) => {
        chartContent.attr('transform', event.transform);
      });
    svg.call(zoom);

    // Zoom in by one step when the chart control is clicked.
    output.querySelector('.graph-zoom-in').addEventListener('click', () => {
      svg.transition().duration(250).call(zoom.scaleBy, 1.5);
    });

    // Zoom out by one step when the chart control is clicked.
    output.querySelector('.graph-zoom-out').addEventListener('click', () => {
      svg.transition().duration(250).call(zoom.scaleBy, -1.5);
    });
  }

  // Load the CSV, populate selectors, and enable chart building when ready
  let headers = [];
  let rows = [];
  fetch(builder.dataset.graphCsvUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Unable to load CSV (${response.status})`);
      }
      return response.text();
    })
    .then((text) => {
      const parsed = parseCsv(text);
      headers = parsed.shift() ?? [];
      rows = parsed;
      setFields(headers);
      status.textContent = headers.length ? 'Choose fields and build a chart.' : 'This CSV has no fields.';
    })
    .catch((error) => {
      status.textContent = error.message;
      output.innerHTML = '<p class="graph-message" role="alert">Unable to load chart data.</p>';
    });

  buildButton.addEventListener('click', () => renderBarChart(headers, rows));
})();
