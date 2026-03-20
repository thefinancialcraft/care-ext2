(function() {
  if (window.location.href === 'https://faveo.careinsurance.com/NewFaveo/#/portal/proposals/proposalDetails') {
    console.log('View Proposals button available. Proceeding to extract table...');

    setTimeout(() => {
      const table = document.querySelector('.Renewal_full.proposal_table_container');
      if (table) {
        let tableData = [];

        function extractTableData() {
          const rows = table.querySelectorAll('tbody tr');
          rows.forEach((row) => {
            const cells = row.querySelectorAll('td');
            const rowData = {};
            cells.forEach((cell, cellIndex) => {
              const columnName = `column_${cellIndex + 1}`;
              rowData[columnName] = cell.textContent.trim();
            });
            tableData.push(rowData);
          });
        }

        extractTableData();
        console.log('Initial Table Data:', tableData);

        const paginationItems = document.querySelectorAll('.pagination .page-item');
        const pageLinks = Array.from(paginationItems).filter(item => {
          const link = item.querySelector('a.page-link');
          if (!link) return false;
          const text = link.textContent.trim();
          return !isNaN(text);
        });

        console.log(`Total numeric pages found: ${pageLinks.length}`);

        function clickAndExtract(index) {
          if (index >= pageLinks.length) {
            console.log('Finished extracting all pages.');
            console.log('Final Table Data:', tableData);
            showDataInHTML(tableData); // Show only after all data collected
            return;
          }

          const pageLink = pageLinks[index].querySelector('a.page-link');
          if (pageLink) {
            setTimeout(() => {
              pageLink.click();
              console.log(`Clicked page: ${pageLink.textContent.trim()}`);
              setTimeout(() => {
                const updatedTable = document.querySelector('.Renewal_full.proposal_table_container');
                if (updatedTable) {
                  extractTableData();
                  console.log(`Table Data after page ${pageLink.textContent.trim()}:`, tableData);
                  clickAndExtract(index + 1);
                } else {
                  console.log('Table not found on new page!');
                  clickAndExtract(index + 1);
                }
              }, 2000);
            }, 2000 * index);
          }
        }

        clickAndExtract(0);

        function showDataInHTML(data) {
          // 🛠️ Step 1: Sort data based on column_5
          data.sort((a, b) => {
            let valA = a['column_5'] || '';
            let valB = b['column_5'] || '';
            if (!isNaN(valA) && !isNaN(valB)) {
              return Number(valA) - Number(valB);
            } else {
              return valA.localeCompare(valB);
            }
          });
        
          // 🛠️ Step 2: Clean old container if exists
          if (document.getElementById('extension-table-container')) {
            document.getElementById('extension-table-container').remove();
          }
        
          // Create container
          const container = document.createElement('div');
          container.id = 'extension-table-container';
          container.style.position = 'fixed';
          container.style.top = '10%';
          container.style.left = '10%';
          container.style.width = '80%';
          container.style.height = '80%';
          container.style.backgroundColor = '#fff';
          container.style.zIndex = '9999';
          container.style.border = '2px solid #000';
          container.style.padding = '20px';
          container.style.overflow = 'auto';
          container.style.boxShadow = '0px 0px 15px rgba(0,0,0,0.3)';
          container.style.borderRadius = '8px';
        
          // Close button
          const closeButton = document.createElement('button');
          closeButton.textContent = 'X';
          closeButton.style.position = 'absolute';
          closeButton.style.top = '10px';
          closeButton.style.right = '10px';
          closeButton.style.backgroundColor = 'red';
          closeButton.style.color = 'white';
          closeButton.style.border = 'none';
          closeButton.style.padding = '5px 10px';
          closeButton.style.cursor = 'pointer';
          closeButton.style.fontWeight = 'bold';
          closeButton.style.fontSize = '16px';
          closeButton.style.borderRadius = '5px';
          closeButton.onclick = () => container.remove();
          container.appendChild(closeButton);
        
          // 🛠️ Step 3: Create Show/Hide button
          const toggleButton = document.createElement('button');
          toggleButton.textContent = 'Show Table';
          toggleButton.style.marginBottom = '10px';
          toggleButton.style.padding = '10px 20px';
          toggleButton.style.backgroundColor = '#007bff';
          toggleButton.style.color = '#fff';
          toggleButton.style.border = 'none';
          toggleButton.style.borderRadius = '5px';
          toggleButton.style.cursor = 'pointer';
          toggleButton.style.fontWeight = 'bold';
          container.appendChild(toggleButton);
        
          // 🛠️ Step 4: Stats Section
          const statsDiv = document.createElement('div');
          statsDiv.style.marginTop = '20px';
          statsDiv.style.marginBottom = '20px';
          statsDiv.style.padding = '10px';
          statsDiv.style.backgroundColor = '#f5f5f5';
          statsDiv.style.border = '1px solid #ddd';
          statsDiv.style.borderRadius = '5px';
          statsDiv.innerHTML = generateStats(data);
          container.appendChild(statsDiv);
        
          // 🛠️ Step 5: Create table (hidden initially)
          const htmlTable = document.createElement('table');
          htmlTable.style.width = '100%';
          htmlTable.style.borderCollapse = 'collapse';
          htmlTable.style.marginTop = '20px';
          htmlTable.style.display = 'none'; // Initially hidden
        
          const thead = document.createElement('thead');
          const headerRow = document.createElement('tr');
          if (data.length > 0) {
            Object.keys(data[0]).forEach(col => {
              const th = document.createElement('th');
              th.style.border = '1px solid #000';
              th.style.padding = '8px';
              th.style.backgroundColor = '#f0f0f0';
              th.textContent = col;
              headerRow.appendChild(th);
            });
          }
          thead.appendChild(headerRow);
          htmlTable.appendChild(thead);
        
          const tbody = document.createElement('tbody');
          data.forEach(row => {
            const tr = document.createElement('tr');
            Object.values(row).forEach(cellData => {
              const td = document.createElement('td');
              td.style.border = '1px solid #000';
              td.style.padding = '8px';
              td.textContent = cellData;
              tr.appendChild(td);
            });
            tbody.appendChild(tr);
          });
          htmlTable.appendChild(tbody);
        
          container.appendChild(htmlTable);
          document.body.appendChild(container);
        
          // 🛠️ Step 6: Toggle Table on button click
          toggleButton.onclick = () => {
            if (htmlTable.style.display === 'none') {
              htmlTable.style.display = 'table';
              toggleButton.textContent = 'Hide Table';
            } else {
              htmlTable.style.display = 'none';
              toggleButton.textContent = 'Show Table';
            }
          };
        
          console.log('Data shown in HTML table with toggle and stats!');
        }
        
// 🛠️ Helper function to generate stats
function generateStats(data) {
  const valueCount = {};
  const valueSum = {};
  const monthlySum = {};
  const pendingSum = {};
  const upcomingSum = {}; // Issuance + Pending per month

  data.forEach(row => {
    const column6Value = row['column_6'] || 'Empty';
    const column4Value = parseFloat(row['column_4']) || 0;
    const column8Value = row['column_8'] || '';

    // Count occurrences and sums
    valueCount[column6Value] = (valueCount[column6Value] || 0) + 1;
    valueSum[column6Value] = (valueSum[column6Value] || 0) + column4Value;

    if (column8Value) {
      const date = new Date(column8Value);
      const monthYear = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;

      // For Issuance
      if (column6Value === 'Inforce' || column6Value === 'Primary:InforceSecondary:BOT Failed') {
        monthlySum[monthYear] = (monthlySum[monthYear] || 0) + column4Value;
        upcomingSum[monthYear] = (upcomingSum[monthYear] || 0) + column4Value;
      }

      // For Pending
      if (
        column6Value === 'Primary:Branch CPU Resolution' ||
        column6Value === 'Primary:Pending Underwriting Review' ||
        column6Value === 'Primary:Pending Tele Q' ||
        column6Value === 'Primary:Payment not cleared' ||
        column6Value === 'Primary:Pending UW requirement'
      ) {
        pendingSum[monthYear] = (pendingSum[monthYear] || 0) + column4Value;
        upcomingSum[monthYear] = (upcomingSum[monthYear] || 0) + column4Value;
      }
    }
  });

  // Begin HTML generation
  let statsHtml = '<h3>📊 Payment Status</h3>';
  statsHtml += `
    <style>
      table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 10px;
      }
      th, td {
        padding: 10px;
        text-align: start;
      }
    </style>
  `;

  // Payment Status Table
  statsHtml += '<table border="1"><thead><tr><th>Status</th><th>Nop</th><th>Total Amount</th></tr></thead><tbody>';
  for (const value in valueCount) {
    const formattedSum = valueSum[value].toLocaleString('en-IN');
    statsHtml += `<tr>
                    <td>${value}</td>
                    <td>${valueCount[value]}</td>
                    <td>₹${formattedSum}</td>
                  </tr>`;
  }
  statsHtml += '</tbody></table>';

  // Issuance Table
  statsHtml += '<h3>📅 Issuance Status</h3>';
  statsHtml += '<table border="1"><thead><tr><th>Month</th><th>Total Amount</th></tr></thead><tbody>';
  for (const monthYear in monthlySum) {
    const formattedMonthSum = monthlySum[monthYear].toLocaleString('en-IN');
    statsHtml += `<tr>
                    <td>${monthYear}</td>
                    <td>₹${formattedMonthSum}</td>
                  </tr>`;
  }
  statsHtml += '</tbody></table>';

  // Pending Table
  statsHtml += '<h3>📅 Pending Status</h3>';
  statsHtml += '<table border="1"><thead><tr><th>Month</th><th>Total Amount</th></tr></thead><tbody>';
  for (const monthYear in pendingSum) {
    const formattedPendingSum = pendingSum[monthYear].toLocaleString('en-IN');
    statsHtml += `<tr>
                    <td>${monthYear}</td>
                    <td>₹${formattedPendingSum}</td>
                  </tr>`;
  }
  statsHtml += '</tbody></table>';

  // Upcoming Issuance Table (Issuance + Pending)
  statsHtml += '<h3>📅 Upcoming Issuance (Issuance + Pending)</h3>';
  statsHtml += '<table border="1"><thead><tr><th>Month</th><th>Total Logged Business (Issuance + Pending)</th></tr></thead><tbody>';

  let totalUpcomingSum = 0;
  for (const monthYear in upcomingSum) {
    const monthTotal = upcomingSum[monthYear];
    totalUpcomingSum += monthTotal;
    statsHtml += `<tr>
                    <td>${monthYear}</td>
                    <td>₹${monthTotal.toLocaleString('en-IN')}</td>
                  </tr>`;
  }

  // Final row: Total Logged Business
  statsHtml += `<tr style="font-weight: bold; background-color: #f0f0f0;">
                  <td>Total Logged Business</td>
                  <td>₹${totalUpcomingSum.toLocaleString('en-IN')}</td>
                </tr>`;
  statsHtml += '</tbody></table>';

  return statsHtml;
}
  
   
        

      } else {
        console.log('Table not found!');
      }
    }, 3000);

  } else {
    console.log('This is not the target page!');
  }
})();
