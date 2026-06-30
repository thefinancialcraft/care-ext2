(function() {
  // 🛡️ [VISIBILITY CONTROL] Hide unauthorized menu items
  function applyVisibilityPermissions() {
    chrome.storage.local.get(['profile_visible', 'renewal_visible', 'digital_discount'], function(res) {
      // Default to true if not set
      const profileVisible = res.profile_visible !== false; 
      const renewalVisible = res.renewal_visible !== false;
      const digitalDiscount = res.digital_discount !== false;

      console.log('🛡️ [VISIBILITY] Profile:', profileVisible, 'Renewal:', renewalVisible, 'Digital Discount:', digitalDiscount);

      // 🛡️ [VISIBILITY CONTROL] Delete Digital Discount
      if (digitalDiscount === false && window.location.href.toLowerCase().includes('portal/')) {
        // Select all spans and paragraphs that might contain the text
        const possibleElems = document.querySelectorAll('span, p.quote-head');
        possibleElems.forEach(elem => {
          if (elem.textContent && elem.textContent.trim().includes('Digital Discount')) {
            console.log('🚫 [VISIBILITY] Deleting Digital Discount element');
            const elementToRemove = elem.closest('label') || elem.closest('span.a_on_btn') || elem.closest('span') || elem;
            if (elementToRemove && elementToRemove.parentNode) {
                if (elementToRemove.tagName === 'LABEL' && elementToRemove.htmlFor) {
                    const linkedInput = document.getElementById(elementToRemove.htmlFor);
                    if (linkedInput) linkedInput.remove();
                }
                if (elementToRemove.previousElementSibling && elementToRemove.previousElementSibling.tagName === 'INPUT') {
                    elementToRemove.previousElementSibling.remove();
                }
                if (elementToRemove.nextElementSibling && elementToRemove.nextElementSibling.tagName === 'INPUT') {
                    elementToRemove.nextElementSibling.remove();
                }
                const container = elementToRemove.closest('.add-on-box, .addon-item, .checkbox, .custom-control, li');
                if (container) {
                    container.remove();
                } else {
                    elementToRemove.remove();
                }
            }
          }
        });
      }

      // Find all menu links
      const menuLinks = document.querySelectorAll('.list-group-item');
      
      menuLinks.forEach(link => {
        const text = link.textContent.trim().toLowerCase();
        
        // Hide/Show "My Profile"
        const isProfile = text === 'my profile' || text.includes('my profile');
        
        if (isProfile) {
          if (profileVisible === false) {
            console.log('🚫 [VISIBILITY] Hiding Profile element');
            const parentLi = link.closest('li');
            if (parentLi) parentLi.style.display = 'none';
            else link.style.display = 'none';
          } else if (profileVisible === true) {
            console.log('✅ [VISIBILITY] Showing Profile element');
            const parentLi = link.closest('li');
            if (parentLi) {
              parentLi.style.display = '';
              if (parentLi.hasAttribute('hidden')) parentLi.removeAttribute('hidden');
            }
            link.style.display = '';
            if (link.hasAttribute('hidden')) link.removeAttribute('hidden');
          }
        }
        
        // Hide/Show "Renewal"
        const isRenewal = text === 'renewal' || text.includes('renewal') || link.closest('.side_renewal_navigation');
        
        if (isRenewal) {
          const parentPanel = link.closest('.list-group.panel');
          if (renewalVisible === false) {
            console.log('🚫 [VISIBILITY] Hiding Renewal element');
            if (parentPanel) parentPanel.style.display = 'none';
            else {
              const parentLi = link.closest('li');
              if (parentLi) parentLi.style.display = 'none';
              else link.style.display = 'none';
            }
          } else if (renewalVisible === true) {
            console.log('✅ [VISIBILITY] Showing Renewal element');
            if (parentPanel) {
              parentPanel.style.display = '';
              if (parentPanel.hasAttribute('hidden')) parentPanel.removeAttribute('hidden');
              // Ensure all children are also visible
              parentPanel.querySelectorAll('*').forEach(c => {
                c.style.display = '';
                if (c.hasAttribute('hidden')) c.removeAttribute('hidden');
              });
            } else {
              const parentLi = link.closest('li');
              if (parentLi) {
                parentLi.style.display = '';
                if (parentLi.hasAttribute('hidden')) parentLi.removeAttribute('hidden');
              }
              link.style.display = '';
              if (link.hasAttribute('hidden')) link.removeAttribute('hidden');
            }
          }
        }
      });
      
      // 🛡️ [VISIBILITY CONTROL] Remove Policy Renewal Notification
      const renewalNotification = document.querySelector('a[title="Policy Renewal Notification"]');
      if (renewalNotification) {
        const parentLi = renewalNotification.closest('li.dropdown');
        if (renewalVisible === false) {
          console.log('🚫 [VISIBILITY] Removing Policy Renewal Notification');
          if (parentLi) parentLi.remove();
          else renewalNotification.remove();
        } else if (renewalVisible === true) {
          // console.log('✅ [VISIBILITY] Showing Policy Renewal Notification'); // Optional log
          if (parentLi) {
            parentLi.style.display = '';
            if (parentLi.hasAttribute('hidden')) parentLi.removeAttribute('hidden');
          }
          renewalNotification.style.display = '';
          if (renewalNotification.hasAttribute('hidden')) renewalNotification.removeAttribute('hidden');
        }
      }

    });
  }

  // Run on load and repeat periodically
  applyVisibilityPermissions();
  setInterval(applyVisibilityPermissions, 2000);

  // 🚀 INSTANT AUTO-DETECT FOR DIGITAL DISCOUNT (MutationObserver)
  chrome.storage.local.get(['digital_discount'], function(res) {
    const digitalDiscount = res.digital_discount !== false;
    if (digitalDiscount === false) {
      const observer = new MutationObserver(() => {
        if (window.location.href.toLowerCase().includes('portal/')) {
          const possibleElems = document.querySelectorAll('span.a_on_btn, p.quote-head, label.add_on_btn, span, b');
          possibleElems.forEach(elem => {
            if (elem.textContent && elem.textContent.trim().includes('Digital Discount')) {
              console.log('🚫 [INSTANT AUTO-DETECT] Deleting Digital Discount element on redirect!');
              const elementToRemove = elem.closest('label') || elem.closest('span.a_on_btn') || elem.closest('span') || elem;
              if (elementToRemove && elementToRemove.parentNode) {
                  if (elementToRemove.tagName === 'LABEL' && elementToRemove.htmlFor) {
                      const linkedInput = document.getElementById(elementToRemove.htmlFor);
                      if (linkedInput) linkedInput.remove();
                  }
                  if (elementToRemove.previousElementSibling && elementToRemove.previousElementSibling.tagName === 'INPUT') {
                      elementToRemove.previousElementSibling.remove();
                  }
                  if (elementToRemove.nextElementSibling && elementToRemove.nextElementSibling.tagName === 'INPUT') {
                      elementToRemove.nextElementSibling.remove();
                  }
                  const container = elementToRemove.closest('.add-on-box, .addon-item, .checkbox, .custom-control, li');
                  if (container) {
                      container.remove();
                  } else {
                      elementToRemove.remove();
                  }
              }
            }
          });
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  });

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

        const paginationItems = document.querySelectorAll('.pagination .page-item');
        const pageLinks = Array.from(paginationItems).filter(item => {
          const link = item.querySelector('a.page-link');
          if (!link) return false;
          const text = link.textContent.trim();
          return !isNaN(text);
        });

        function clickAndExtract(index) {
          if (index >= pageLinks.length) {
            showDataInHTML(tableData);
            return;
          }

          const pageLink = pageLinks[index].querySelector('a.page-link');
          if (pageLink) {
            setTimeout(() => {
              pageLink.click();
              setTimeout(() => {
                const updatedTable = document.querySelector('.Renewal_full.proposal_table_container');
                if (updatedTable) {
                  extractTableData();
                  clickAndExtract(index + 1);
                } else {
                  clickAndExtract(index + 1);
                }
              }, 2000);
            }, 2000 * index);
          }
        }

        clickAndExtract(0);

        function showDataInHTML(data) {
          data.sort((a, b) => {
            let valA = a['column_5'] || '';
            let valB = b['column_5'] || '';
            if (!isNaN(valA) && !isNaN(valB)) return Number(valA) - Number(valB);
            return valA.localeCompare(valB);
          });
        
          if (document.getElementById('extension-table-container')) {
            document.getElementById('extension-table-container').remove();
          }
        
          const container = document.createElement('div');
          container.id = 'extension-table-container';
          Object.assign(container.style, {
            position: 'fixed', top: '10%', left: '10%', width: '80%', height: '80%',
            backgroundColor: '#fff', zIndex: '9999', border: '2px solid #000',
            padding: '20px', overflow: 'auto', boxShadow: '0px 0px 15px rgba(0,0,0,0.3)', borderRadius: '8px'
          });
        
          const closeButton = document.createElement('button');
          closeButton.textContent = 'X';
          Object.assign(closeButton.style, {
            position: 'absolute', top: '10px', right: '10px', backgroundColor: 'red',
            color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer', fontWeight: 'bold'
          });
          closeButton.onclick = () => container.remove();
          container.appendChild(closeButton);
        
          const statsDiv = document.createElement('div');
          statsDiv.style.marginTop = '20px';
          statsDiv.innerHTML = generateStats(data);
          container.appendChild(statsDiv);
        
          document.body.appendChild(container);
        }
        
        function generateStats(data) {
          const valueCount = {}, valueSum = {}, monthlySum = {}, pendingSum = {}, upcomingSum = {};

          data.forEach(row => {
            const column6Value = row['column_6'] || 'Empty';
            const column4Value = parseFloat(row['column_4']) || 0;
            const column8Value = row['column_8'] || '';

            valueCount[column6Value] = (valueCount[column6Value] || 0) + 1;
            valueSum[column6Value] = (valueSum[column6Value] || 0) + column4Value;

            if (column8Value) {
              const date = new Date(column8Value);
              const monthYear = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;

              if (column6Value === 'Inforce' || column6Value === 'Primary:InforceSecondary:BOT Failed') {
                monthlySum[monthYear] = (monthlySum[monthYear] || 0) + column4Value;
                upcomingSum[monthYear] = (upcomingSum[monthYear] || 0) + column4Value;
              }

              if (['Primary:Branch CPU Resolution','Primary:Pending Underwriting Review','Primary:Pending Tele Q','Primary:Payment not cleared','Primary:Pending UW requirement'].includes(column6Value)) {
                pendingSum[monthYear] = (pendingSum[monthYear] || 0) + column4Value;
                upcomingSum[monthYear] = (upcomingSum[monthYear] || 0) + column4Value;
              }
            }
          });

          let statsHtml = '<h3>📊 Payment Status</h3><table border="1" style="width:100%; border-collapse:collapse;"><thead><tr><th>Status</th><th>Nop</th><th>Amount</th></tr></thead><tbody>';
          for (const val in valueCount) {
            statsHtml += `<tr><td>${val}</td><td>${valueCount[val]}</td><td>₹${valueSum[val].toLocaleString('en-IN')}</td></tr>`;
          }
          statsHtml += '</tbody></table>';
          return statsHtml;
        }
      }
    }, 3000);
  }
})();
