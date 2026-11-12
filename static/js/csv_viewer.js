(() => {
  const viewer = document.querySelector('.csv-viewer');

  const url = viewer.dataset.csvUrl;
  const status = document.querySelector('#csv-status');
  const search = document.querySelector('#csv-search');
  const container = document.querySelector('#csv-table-container');
  const previewLimit = 500;
  let rows = [];
  let headers = [];

  function parseCsv(input) {
    const result = [];
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
        if (row.some((value) => value !== '')) result.push(row);
        row = [];
        field = '';
      } 
      else {
        field += character;
      }
    }
    if (field !== '' || row.length > 0) {
      row.push(field);
      if (row.some((value) => value !== '')) result.push(row);
    }
    return result;
  }

  function render(filteredRows = rows) {
    if (headers.length === 0) {
      container.innerHTML = '<p class="csv-message">This CSV does not contain any fields.</p>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'rdg';
    table.setAttribute('aria-label', 'CSV data');

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.className = 'rdg-header-row';
    const indexHeader = document.createElement('th');
    indexHeader.className = 'rdg-index-cell';
    indexHeader.scope = 'col';
    indexHeader.textContent = '#';
    headerRow.append(indexHeader);
    headers.forEach((header) => {
      const cell = document.createElement('th');
      cell.className = 'rdg-cell rdg-header-cell';
      cell.scope = 'col';
      cell.textContent = header || 'Unnamed field';
      headerRow.append(cell);
    });
    thead.append(headerRow);
    table.append(thead);

    const tbody = document.createElement('tbody');
    filteredRows.forEach((row, rowIndex) => {
      const tableRow = document.createElement('tr');
      tableRow.className = rowIndex % 2 === 0 ? 'rdg-row-even' : 'rdg-row-odd';
      const indexCell = document.createElement('th');
      indexCell.className = 'rdg-index-cell';
      indexCell.scope = 'row';
      indexCell.textContent = String(rowIndex + 1);
      tableRow.append(indexCell);
      headers.forEach((_, index) => {
        const cell = document.createElement('td');
        cell.className = 'rdg-cell';
        cell.textContent = row[index] ?? '';
        tableRow.append(cell);
      });
      tbody.append(tableRow);
    });
    table.append(tbody);
    container.replaceChildren(table);
    const total = parsedRowCount;
    status.textContent = `${headers.length} fields · ${filteredRows.length}${total > previewLimit ? ` of ${total}` : ''} rows shown`;
  }

  let parsedRowCount = 0;
  fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Unable to load CSV (${response.status})`);
      return response.text();
    })
    .then((text) => {
      const parsed = parseCsv(text);
      headers = parsed.shift() ?? [];
      parsedRowCount = parsed.length;
      rows = parsed.slice(0, previewLimit);
      render();
      search.disabled = false;
    })
    .catch((error) => {
      status.textContent = error.message;
      container.innerHTML = '<p class="csv-message" role="alert">Unable to load this dataset.</p>';
    });

  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    render(query ? rows.filter((row) => row.some((value) => value.toLowerCase().includes(query))) : rows);
  });

})();
