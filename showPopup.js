(function () {
    // ====== ICON LOADERS ======
    const loadIconCDN = () => {
      const loadCDN = (href) => {
        if (!document.querySelector(`link[href="${href}"]`)) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = href;
          document.head.appendChild(link);
        }
      };
  
      loadCDN('https://cdn-uicons.flaticon.com/3.0.0/uicons-thin-straight/css/uicons-thin-straight.css'); // Drag Icon
      loadCDN('https://cdn-uicons.flaticon.com/2.6.0/uicons-bold-rounded/css/uicons-bold-rounded.css'); // Cross Icon
    };
    
    // ====== SPINNER CREATION ======
    const createSpinner = () => {
      const spinnerContainer = document.createElement('div');
      spinnerContainer.style.display = 'flex';
      spinnerContainer.style.position = 'absolute';
      spinnerContainer.style.justifyContent = 'center';
      spinnerContainer.style.alignItems = 'center';
      spinnerContainer.style.right = '20px';
      spinnerContainer.style.top = '60px';
  
      const spinner = document.createElement('div');
      spinner.style.border = '4px solid #f3f3f3';
      spinner.style.borderTop = '4px solid #0065b3';
      spinner.style.borderRadius = '50%';
      spinner.style.width = '30px';
      spinner.style.height = '30px';
      spinner.style.animation = 'spin 1s linear infinite';
      spinnerContainer.appendChild(spinner);
      return spinnerContainer;
    };
  
    const addSpinnerStyle = () => {
      const style = document.createElement('style');
      style.innerHTML = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    };


  
    // ====== TOP BAR CREATION ======
    const createTopBar = (popup) => {
      const topContainer = document.createElement('div');
      Object.assign(topContainer.style, {
        display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        width: '100%', height: '30px', borderBottom: '1px solid #bcbcbc', marginBottom: '10px', padding: '5px',
      });
  
      const dragIcon = document.createElement('span');
      dragIcon.className = 'fi fi-ts-scrubber';
      Object.assign(dragIcon.style, {
        cursor: 'move', fontSize: '15px', color: '#bcbcbc', marginBottom: '8px',
      });
  
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '<i class="fi fi-br-cross"></i>';
      Object.assign(closeBtn.style, {
        background: 'transparent', color: '#bcbcbc', border: 'none', fontSize: '12px', cursor: 'pointer',
      });
      closeBtn.onclick = () => popup.remove();
  
      topContainer.appendChild(dragIcon);
      topContainer.appendChild(closeBtn);
  
      makeDraggable(popup, dragIcon);
      return topContainer;
    };


  
    // ====== BUTTON CONTAINER CREATION ======
    const createButtonContainer = (popup) => {
      const container = document.createElement('div');
      container.id = 'mainActBtn';
      Object.assign(container.style, {
        marginTop: '10px', display: 'none', flexWrap: 'wrap', gap: '10px', flexDirection: 'row',
      });
  
      const buttonNames = ['Current Month', 'Custom Month'];
      buttonNames.forEach((name) => {
        const btn = document.createElement('button');
        btn.innerText = name;
        Object.assign(btn.style, {
          padding: '6px 12px', border: '1px solid #ccc', borderRadius: '5px',
          cursor: 'pointer', background: '#fff', fontSize: '12px',
          color: '#0065b3', fontWeight: 'bold', transition: 'all 0.1s ease'
        });
  
        btn.onmouseover = () => { btn.style.background = '#0065b3'; btn.style.color = '#fff'; };
        btn.onmouseout = () => { btn.style.background = '#fff'; btn.style.color = '#0065b3'; };
  
        if (name === 'Current Month') {
          btn.onclick = () => handleCurrentMonthClick(popup);
        } else if (name === 'Custom Month') {
          btn.onclick = () => handleCustomMonthClick(popup);
        }
  
        container.appendChild(btn);
      });
  
      return container;
    };
  
    function createMessageDiv() {
        const messageDiv = document.createElement('div');
        messageDiv.id = 'messageDiv';
        messageDiv.style.borderTop = '1px solid #bcbcbc';
        messageDiv.style.borderBottom = '1px solid #bcbcbc';
        messageDiv.style.marginTop = '12px';
        messageDiv.style.width = '100%';
        messageDiv.style.height = '300px';
        messageDiv.style.overflow = 'hidden'; // both axes
        messageDiv.style.overflowY = 'auto'; // both axes
        messageDiv.style.scrollbarWidth = 'none'; // Firefox
        messageDiv.style.msOverflowStyle = 'none'; // IE/Edge
        // messageDiv.style.padding = '10px';
        messageDiv.borderRadius = '10px';
        messageDiv.style.fontWeight = 'bold';
        messageDiv.style.textAlign = 'center';
      
        // Hide scroll bar for Chrome/Safari
        if (!document.getElementById('hideScrollbarStyle')) {
          const style = document.createElement('style');
          style.id = 'hideScrollbarStyle';
          style.textContent = `
            #messageDiv::-webkit-scrollbar {
              display: none;
            }
          `;
          document.head.appendChild(style);
        }
      
        return messageDiv;
      }


    // ====== DATA UI CREATION ======
    
    function createDataUiContainer() {
      const container = document.createElement('div');
      container.id = 'dataUi';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.alignItems = 'center';
      container.style.gap = '12px';
      container.style.paddingTop = '20px';

      container.style.width = '100%';
      container.style.height = '100%';
      container.style.fontFamily = 'Arial, sans-serif';
      return container;
  }
  
  function createBlockUi() {
    const block = document.createElement('div');
    block.id = 'blockUi';
    block.style.display = 'flex';
    block.style.flexDirection = 'row';
    block.style.alignItems = 'center';
    block.style.justifyContent = 'center';
    // block.marginBottom = '10px';
    block.style.width = '100%';
    block.style.height = '100px';
    block.style.fontFamily = 'Arial, sans-serif';
    // block.style.backgroundColor = '#f9f9f9';
    block.style.borderRadius = '10px';

  
    // Call the createHalfCirBarWithPercentage function, passing the parent element and the percentage

    return block;
  }
  

  function createHalfCirBarWithPercentage(percent) {
    const style = document.createElement('style');
    style.innerHTML = `
      .half-circular-progress {
        --size: 100;
        --stroke-width: 10;
        --radius: calc((var(--size) - var(--stroke-width)) / 2);
        --circumference: calc(3.1416 * var(--radius));
        width: 80px;
        height: 35px;
        position: relative;
      }

      .half-circular-progress circle {
        cx: 50;
        cy: 50;
        r: calc((var(--size) - var(--stroke-width)) / 2);
        fill: none;
        stroke-width: var(--stroke-width);
        stroke-linecap: round;
      }

      .half-circular-progress .bg {
        stroke:rgba(218, 239, 255, 0.14);
        stroke-dasharray: calc(3.1416 * ((var(--size) - var(--stroke-width)) / 2));
        stroke-dashoffset: 0;
        transform: rotate(-180deg);
        transform-origin: 50px 50px;
        stroke-linecap: round; /* ✅ Add this */
      }

      .half-circular-progress .fg {
        stroke: #FFFFFF;
        stroke-dasharray: calc(3.1416 * ((var(--size) - var(--stroke-width)) / 2));
        transform: rotate(-180deg);
        transform-origin: 50px 50px;
      }

      .percent-text {
        position: absolute;
        top: 18px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 14px;
        font-weight: bold;
        color: #FFFFFF;
      }

      .status-label {
        margin-top: 1px;
        font-size: 11px;
        font-weight: 600;
        margin-top: 6px;
        color: #FFFFFF;

      }
    `;
    document.head.appendChild(style);
    // Parent container
    const parentElement = createBlockUi();
    
    // Create main div container for halfCirBar
    const halfCirBar = document.createElement("div");
    halfCirBar.id = "halfCirBar";
    halfCirBar.style.display = "flex";
    halfCirBar.style.flexDirection = "column";
    halfCirBar.style.alignItems = "center"; 
    halfCirBar.style.justifyContent = "center";
    halfCirBar.style.width = "100px";
    halfCirBar.style.height = "80px";
    halfCirBar.style.backgroundColor = "#0065b3";
    halfCirBar.style.position = "relative";
    halfCirBar.style.borderRadius = "10px";
    
    // Create half-circular progress div
    const progressDiv = document.createElement("div");
    progressDiv.classList.add("half-circular-progress");
  
    // Create SVG for the half circle
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "80");
    svg.setAttribute("height", "35");
    svg.setAttribute("viewBox", "0 0 100 50");
  
    // Create background circle (static)
    const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    bgCircle.classList.add("bg");
  
    // Create foreground circle (dynamic progress)
    const fgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    fgCircle.classList.add("fg");
    fgCircle.id = "progress-circle";
  
    // Append circles to SVG
    svg.appendChild(bgCircle);
    svg.appendChild(fgCircle);
  
    // Create percentage display
    const percentText = document.createElement("div");
    percentText.classList.add("percent-text");
    percentText.id = "percent-display";
    percentText.textContent = `${percent}%`;
  
    // Create status label
    const statusLabel = document.createElement("div");
    statusLabel.classList.add("status-label");
    statusLabel.textContent = "Issued Case"; // Default status
  
    // Append everything to the halfCirBar div
    progressDiv.appendChild(svg);
    progressDiv.appendChild(percentText);
    halfCirBar.appendChild(progressDiv);
    halfCirBar.appendChild(statusLabel);
    
    // Append the halfCirBar to the parent element
    parentElement.appendChild(halfCirBar);
  
    // Set up the progress functionality
    const radius = (100 - 10) / 2;
    const halfCircumference = Math.PI * radius;
  
    let currentPercent = 0;
    let animationInterval = null;
  
    fgCircle.style.strokeDasharray = halfCircumference;
    fgCircle.style.strokeDashoffset = halfCircumference;
  
    function setHalfProgressSmooth(targetPercent) {
      if (animationInterval) clearInterval(animationInterval);
  
      animationInterval = setInterval(() => {
        if (currentPercent === targetPercent) {
          clearInterval(animationInterval);
          return;
        }
  
        if (currentPercent < targetPercent) currentPercent++;
        else currentPercent--;
  
        const offset = halfCircumference * (1 - currentPercent / 100);
        fgCircle.style.strokeDashoffset = offset;
        percentText.textContent = `${currentPercent}%`;
  
        if (currentPercent === 0) {
          fgCircle.style.stroke = "transparent";
          fgCircle.style.opacity = "0";
        } else {
          fgCircle.style.stroke = "#FFFFFF";
          fgCircle.style.opacity = "1";
        }
      }, 10);
    }
  
    // Call the function to animate the progress
    setHalfProgressSmooth(percent);
    
    
 
  
    // Return the created halfCirBar element
    return halfCirBar;
  }
  

  function createPaymentBox(amount) {
    // Parent container
    const parentElement = createBlockUi();

    // Create the <style> element for CSS
    const style = document.createElement("style");
    style.textContent = `

      #ttlAmt p {
        font-size: 12px;
        color: #333;
        margin-top: -5px;
      }

      #ttlAmt #ttlUpcPay {
        color: #0065b3;
        margin-top: -8px;
        font-size: 24px !important;
        font-weight: 800;

      }
    `;
    // Append the style to the document's head
    document.head.appendChild(style);

    // Create the main div for ttlAmt
    const ttlAmt = document.createElement("div");
    ttlAmt.id = "ttlAmt";
    ttlAmt.style.display = "flex";
    ttlAmt.style.flexDirection = "column";
    ttlAmt.style.alignItems = "center";
    ttlAmt.style.justifyContent = "center";
    ttlAmt.style.width = "200px";
    ttlAmt.style.height = "80px";
    ttlAmt.style.boxSizing = "border-box";
    ttlAmt.style.padding = "20px";
    ttlAmt.style.fontSize = "24px";
    ttlAmt.style.border = "none";

    // Create the p element (Upcoming Payment text)
    const p = document.createElement("p");
    p.textContent = "Upcoming payment";

    // Create the h1 element (for the amount)
    const h1 = document.createElement("h1");
    h1.id = "ttlUpcPay";
    h1.textContent = amount;

    // Append p and h1 to ttlAmt div
    ttlAmt.appendChild(p);
    ttlAmt.appendChild(h1);

    // Append ttlAmt div to parentElement
    parentElement.appendChild(ttlAmt);

    // Return the created ttlAmt element
    return ttlAmt;
  }

  function createPaymentComponentFromObject(dataObj) {
    // 1. Inject style
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');
      @import url('https://cdn-uicons.flaticon.com/2.6.0/uicons-regular-rounded/css/uicons-regular-rounded.css');
  
      #container-c {
        background-color: #0065b3;
        width: 320px;
        padding: 3px;
        border-radius: 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
        font-family: 'Roboto', sans-serif;
        box-sizing: border-box;
      }
  
      .con-hd {
        width: 95%;
        height: 40px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        color: #ffffff;
        font-size: 16px;
      }
  
      .con-hd p {
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0px;

      }
  
      .div-tabel {
        width: 100%;
        background-color: #ffffff;
        border-radius: 10px;
        display: flex;
        flex-direction: column;
        font-size: 11px;
        font-style: italic;
        font-weight: 400;
        overflow: hidden;
        transition: height 0.1s ease, padding 0.3s ease;
        height: 0;
      }
  
      .div-tabel.collapsed {
        height: auto !important;
        padding: 10px 0px;
      }
  
      
      .div-hd, .div-bdy {
        width: 95%;
        display: flex;
        flex-direction: column;
        margin: auto;
      }
  
      .div-hd {
        flex-direction: row;
        justify-content: space-between;
        background-color: #0065b3;
        color: #ffffff;
        padding: 5px;
        border-radius: 10px;
      }
  
      .div-dt1 {
        width: 60%;
        padding: 2px 0 2px 10px;
        word-wrap: break-word;
        overflow-wrap: break-word;
        text-align: left;
      }
  
      .div-dt2, .div-dt3 {
        width: 25%;
        text-align: center;
        padding: 2px 0;
      }
  
      .div-rw {
        width: 100%;
        display: flex;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid #bebebe46;
      }
  
      #toggleIcon {
        transition: transform 0.3s ease;
        cursor: pointer;
        font-size: 20px;
        transform: rotate(0deg);
        display:flex;
        justify-content: center;
        align-item: center;

      }
  
      #toggleIcon.rotated {
        transform: rotate(90deg);
      }
    `;
    document.head.appendChild(style);
  
    // 2. Create elements
    const container = document.createElement('div');
    container.id = 'container-c';
  
    const conHd = document.createElement('div');
    conHd.className = 'con-hd';
  
    const p = document.createElement('p');
    p.textContent = 'Payment Summary';
  
    const toggleIcon = document.createElement('i');
    toggleIcon.className = 'fi fi-rr-angle-small-right';
    toggleIcon.id = 'toggleIcon';
  
    conHd.appendChild(p);
    conHd.appendChild(toggleIcon);
  
    const tableBox = document.createElement('div');
    tableBox.className = 'div-tabel';
  
    // 3. Header
    const header = document.createElement('div');
    header.className = 'div-hd';
  
    const head1 = document.createElement('div');
    head1.className = 'div-dt1';
    head1.textContent = 'Status';
  
    const head2 = document.createElement('div');
    head2.className = 'div-dt2';
    head2.textContent = 'Nop';
  
    const head3 = document.createElement('div');
    head3.className = 'div-dt3';
    head3.textContent = 'Payment';
  
    header.appendChild(head1);
    header.appendChild(head2);
    header.appendChild(head3);
  
    // 4. Body
    const body = document.createElement('div');
    body.className = 'div-bdy';
  
    Object.keys(dataObj).forEach(statusKey => {
      const item = dataObj[statusKey];
      if (!item || typeof item !== 'object') return;
  
      const row = document.createElement('div');
      row.className = 'div-rw';
  
      const div1 = document.createElement('div');
      div1.className = 'div-dt1';
      div1.textContent = statusKey;
  
      const div2 = document.createElement('div');
      div2.className = 'div-dt2';
      div2.textContent = item.count || 0;
  
      const div3 = document.createElement('div');
      div3.className = 'div-dt3';
      div3.textContent = 'Rs ' + (item.sum || 0).toLocaleString();
  
      row.appendChild(div1);
      row.appendChild(div2);
      row.appendChild(div3);
      body.appendChild(row);
  
      row.addEventListener('click', () => {
        showDesireData(item.entries || []);
        const tabelBtn = document.getElementById('showdata');
        if (tabelBtn) tabelBtn.innerHTML = 'Hide Data';
      });
    });
  
    // 5. Assemble
    tableBox.appendChild(header);
    tableBox.appendChild(body);
    container.appendChild(conHd);
    container.appendChild(tableBox);
  
    // 6. Toggle logic
    toggleIcon.addEventListener('click', () => {
      tableBox.classList.toggle('collapsed');
      toggleIcon.classList.toggle('rotated');

    });
  
    return container;
  }
  

  
  function createDataUi(monthlySum, upcomingSum, pendingSum, cancelationSum, businesstype, proposalStatusStats) {
    const popup = document.getElementById('my-dashboard-popup');
    if (!popup) return console.log('Popup element not found.');
  
    const dataUi = createDataUiContainer();
    const blockUi = createBlockUi();
    const messageDiv = createMessageDiv();
    const statusTabel = createPaymentComponentFromObject(proposalStatusStats);
   


     // 🔢 Count all entries
  const totalUpcomingEntries = Object.values(upcomingSum).reduce((sum, item) => sum + (item.entries?.length || 0), 0);
  const totalIssuedEntries = Object.values(monthlySum).reduce((sum, item) => sum + (item.entries?.length || 0), 0);

  // 📊 Calculate percentage
  let pendingPercentage = totalUpcomingEntries > 0 
    ? Math.round((totalIssuedEntries / totalUpcomingEntries) * 100) 
    : 0;

    const halfCirBar = createHalfCirBarWithPercentage(pendingPercentage);
  
    // 🔽 Calculate the total of all "upcomingSum[month].total" values
    let grandUpcomingTotal = Object.values(upcomingSum).reduce((sum, obj) => sum + (obj?.total || 0), 0);
    const formattedTotal = "₹" + grandUpcomingTotal.toLocaleString("en-IN");
  
    const ttlAmt = createPaymentBox(formattedTotal); // ✅ Use actual calculated total
  
    popup.appendChild(messageDiv);
    messageDiv.appendChild(dataUi);
    dataUi.appendChild(blockUi);
    blockUi.appendChild(ttlAmt);
    blockUi.appendChild(halfCirBar);
    dataUi.appendChild(statusTabel);


  
// Show all monthly entries
halfCirBar.onclick = () => {
  let allEntries = [];
  Object.values(monthlySum).forEach(item => {
    if (item.entries && Array.isArray(item.entries)) {
      allEntries = allEntries.concat(item.entries);
    }
  });
  showDesireData(allEntries);
  const tabelBtn = document.getElementById('showdata');
  tabelBtn.innerHTML = 'Hide Data';
};

// Show all upcoming entries
ttlAmt.onclick = () => {
  let allEntries = [];
  Object.values(upcomingSum).forEach(item => {
    if (item.entries && Array.isArray(item.entries)) {
      allEntries = allEntries.concat(item.entries);
    }
  });
  showDesireData(allEntries);
  const tabelBtn = document.getElementById('showdata');
  tabelBtn.innerHTML = 'Hide Data';
};

  
  
    console.log("Issued Sum:", monthlySum);
    console.log("Upcoming Sum:", upcomingSum);
    console.log("Pending Sum:", pendingSum);
    console.log("Cancelation Sum:", cancelationSum);
    console.log("Business Type Summary:", businesstype);
    console.log("Proposal Status", proposalStatusStats);
  }


  const showDesireData = (data) => {
    const messageDiv = document.getElementById('messageDiv');
    if (!messageDiv) {
      console.warn('messageDiv not found!');
      return;
    }
  
    messageDiv.innerHTML = ''; // Clear existing content
  
    // Create and append style if not already present
    if (!document.getElementById('customTableStyle')) {
      const style = document.createElement('style');
      style.id = 'customTableStyle';
      style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap');
        .custom-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px !important;  
          font-family: 'Roboto', sans-serif;
          position: relative;
        }
        .custom-table th, .custom-table td {
          padding: 8px 10px;
          text-align: center;
          font-style: italic;
          white-space: nowrap;
          border-bottom: 1px solid #bcbcbc;
          color: rgb(114, 114, 114);
        }
        .custom-table th {
          background: #0065b3;
          color: #fff;
          font-weight: bold;
          position: sticky;
          top: 0;
          z-index: 1;
        }
        #dataTable {
          max-height: 300px;
          overflow: auto;
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE and Edge */
        }
        #dataTable::-webkit-scrollbar {
          display: none; /* Chrome, Safari */
        }
      `;
      document.head.appendChild(style);
    }
  
    // Create inner container
    const container = document.createElement('div');
    container.id = 'dataTable';
    container.style.overflow = 'auto';
    container.style.maxHeight = '300px';
    messageDiv.appendChild(container);
    messageDiv.style.display = 'block';
  
    if (!Array.isArray(data) || data.length === 0) {
      container.textContent = 'No data available.';
      return;
    }
  
    // Determine valid keys (exclude undefined keys and keys with only undefined/null values)
    const validKeys = Object.keys(data[0]).filter(
      key => key !== 'undefined' && data.some(row => row[key] !== undefined && row[key] !== null)
    );
  
    // Build the table
    const table = document.createElement('table');
    table.className = 'custom-table';
  
    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
  
    // Add Sno. column
    const snoTh = document.createElement('th');
    snoTh.textContent = 'Sno.';
    headerRow.appendChild(snoTh);
  
    // Add dynamic headers
    validKeys.forEach(key => {
      const th = document.createElement('th');
      th.textContent = key.replace(/_/g, ' ');
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
  
    // Body
    const tbody = document.createElement('tbody');
    data.forEach((row, index) => {
      const tr = document.createElement('tr');
  
      // Add Sno.
      const snoTd = document.createElement('td');
      snoTd.textContent = index + 1;
      tr.appendChild(snoTd);
  
      // Add valid data cells
      validKeys.forEach(key => {
        const td = document.createElement('td');
        td.textContent = row[key] ?? '';
        tr.appendChild(td);
      });
  
      tbody.appendChild(tr);
    });
  
    table.appendChild(tbody);
    container.appendChild(table);
  };
  
  



  // Function to process and accumulate data
  function processData(accumulatedData) {
    let proposalStatusStats = {};  // For storing counts, sums, and entries
    let monthlySum = {};
    let upcomingSum = {};
    let pendingSum = {};
    let cancelationSum = {};
    let businesstype = {
      NEWBUSINESS: { monthly: {}, pending: {}, upcoming: {} },
      PORTABILITY: { monthly: {}, pending: {}, upcoming: {} },
      RENEWAL: { monthly: {}, pending: {}, upcoming: {} }
    };
  
    accumulatedData.forEach(entry => {
      const column4Value = parseFloat(entry.GWP.replace(/,/g, '')) || 0;
      const column6Value = entry.PROPOSAL_STATUS;
      const businessType = entry.BUSINESS_TYPE;
      const date = new Date(entry.POLICY_START_DATE);
      const monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' }).toUpperCase();
  
      // Helper to update structure with total and entries
      const updateSum = (sumObj) => {
        sumObj[monthYear] = sumObj[monthYear] || { total: 0, entries: [] };
        sumObj[monthYear].total += column4Value;
        sumObj[monthYear].entries.push(entry);
      };


             // Initialize if not already
       if (!proposalStatusStats[column6Value]) {
         proposalStatusStats[column6Value] = {
           count: 0,
           sum: 0,
           entries: []
         };
       }
       
       // Update
       proposalStatusStats[column6Value].count += 1;
       proposalStatusStats[column6Value].sum += column4Value;
       proposalStatusStats[column6Value].entries.push(entry);
       
  
  
      // For Issuance
      if (column6Value === 'Inforce' || column6Value === 'Primary:InforceSecondary:BOT Failed') {
        updateSum(monthlySum);
        updateSum(upcomingSum);
      }
  
      // For Pending
      const pendingStatuses = [
        'Primary:Branch CPU Resolution',
        'Primary:Pending Underwriting Review',
        'Primary:Pending Tele Q',
        'Primary:Pending Underwriting',
        'Primary:Payment not cleared',
        'Primary:Pending UW requirement'
      ];
      if (pendingStatuses.includes(column6Value)) {
        updateSum(pendingSum);
        updateSum(upcomingSum);
      }
  
      // For Cancelation
      const cancelStatuses = [
        'Primary:Declined',
        'Primary:DeclinedSecondary:AUTHORISED',
        'Primary:CancelledSecondary:AUTHORISED',
        'Primary:Cancelled'
      ];
      if (cancelStatuses.includes(column6Value)) {
        updateSum(cancelationSum);
      }
  
      // For Business Type Summary
      if (businesstype[businessType]) {
        if (column6Value === 'Inforce' || column6Value === 'Primary:InforceSecondary:BOT Failed') {
          updateSum(businesstype[businessType].monthly);
          updateSum(businesstype[businessType].upcoming);
        }
        if (pendingStatuses.includes(column6Value)) {
          updateSum(businesstype[businessType].pending);
        }
      }
    });
  

    createDataUi(monthlySum,
      upcomingSum,
      pendingSum,
      cancelationSum,
      businesstype,
      proposalStatusStats); // Create the UI after processing data

  

  }
  


  
    // ====== SECONDARY BUTTON CONTAINER CREATION ======
    const createSecondaryButtonContainer = () => {
        const container = document.createElement('div');
        container.id = 'secActBtn';
        Object.assign(container.style, {
          marginTop: '10px',
          display: 'flex',  // Initially hidden
          flexDirection: 'column',
          gap: '10px',
          width: '100%',
        });
      
        const buttonGroups = [
          ['Add More', 'Send to Api'],
          ['Main Menu', 'Show Data']
        ];
      
        buttonGroups.forEach(group => {
          const span = document.createElement('span');
          Object.assign(span.style, {
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            marginTop: '10px',  
          });
      
          group.forEach(name => {
            const btn = document.createElement('button');
            btn.innerText = name;
            btn.id = name.replace(/\s+/g, '').toLowerCase(); // Set ID based on button name
            Object.assign(btn.style, {
              width: '48%',
              height: '30px',
              border: '1px solid #fff',
              borderRadius: '5px',
              cursor: 'pointer',
              background: '#0065b3',
              fontSize: '12px',
              color: '#fff',
              fontWeight: 'bold',
              transition: 'all 0.1s ease'
            });
      
            btn.addEventListener('mouseover', () => {
              btn.style.background = '#fff';
              btn.style.color = '#0065b3';
              btn.style.border = '1px solid #0065b3';
            });
            btn.addEventListener('mouseout', () => {
              btn.style.background = '#0065b3';
              btn.style.color = '#fff';
              btn.style.border = '1px solid #fff';
            });
      
            // Button click actions can be defined here
            btn.addEventListener('click', () => {
              console.log(`${name} button clicked`);
            });
      
            btn.addEventListener('click', () => {

              if (btn.innerText === 'Show Data') {
                renderExtractedTable(); // Show the table
                btn.innerText = 'Hide Data';
                
              } else if (btn.innerText === 'Hide Data') {
                const popup = document.getElementById('my-dashboard-popup');
               
                const oldMessageDiv = document.getElementById('messageDiv');
                if (oldMessageDiv) oldMessageDiv.remove();
            
                // 🧹 Remove existing buttonContainer if present
                const oldButtonContainer = document.getElementById('secActBtn');
                if (oldButtonContainer) oldButtonContainer.remove();
                processData(accumulatedData);   // Create new UI
                const secActBtn = createSecondaryButtonContainer(); // Recreate the button container
                popup.appendChild(secActBtn); // Append the new button container
                secActBtn.style.display = 'block';
                // Hide the table
                btn.innerText = 'Show Data';
              } else {
                console.log(`${name} button clicked`);
              }
            });
            
            btn.addEventListener('click', () => {
              if (name === 'Send to Api') {
                sendDataToAppScript(); // ✅ Trigger only when "Send to Api" button is clicked
              } else {
                console.log(`${name} button clicked`);
              }
            });

            btn.addEventListener('click', () => {
              if (name === 'Main Menu') {
                const popup = document.getElementById('my-dashboard-popup');
            
                // 🧹 Remove existing messageDiv if present
                const oldMessageDiv = document.getElementById('messageDiv');
                if (oldMessageDiv) oldMessageDiv.remove();
            
                // 🧹 Remove existing buttonContainer if present
                const oldButtonContainer = document.getElementById('secActBtn');
                if (oldButtonContainer) oldButtonContainer.remove();
            
                // 👉 Also trigger click on sidebar's "Dashboard" <a> element
                const dashboardLink = document.querySelector('.side_dash_navigation .dropdown11');
                if (dashboardLink) dashboardLink.click();
                document.getElementById('sidebarwrapper')?.classList.remove('toggled');
                document.getElementById('sideBackdrop')?.classList.remove('backdrop1');
                
            
                // 🚀 Create and show new button container
                const actionUI = createButtonContainer();
                popup.appendChild(actionUI);
                actionUI.style.display = 'flex';
            
              } else {
                console.log(`${name} button clicked`);
              }
            });
            

              btn.addEventListener('click', () => {
                if (name === 'Add More') {
                  handleAddMoreClick(tableData);
                } else {
                  console.log(`${name} button clicked`);
                }
              });
              

            span.appendChild(btn);
          });
      
          container.appendChild(span);
        });
      
        return container;
      };



    // ====== ADD MORE BUTTON FUNCTION ======
    function handleAddMoreClick() {
    
      const popup = document.getElementById('my-dashboard-popup');
    
      // 🧹 Remove existing messageDiv if present
      const oldMessageDiv = document.getElementById('messageDiv');
      if (oldMessageDiv) oldMessageDiv.remove();
    
      // 🧹 Remove existing buttonContainer if present
      const oldButtonContainer = document.getElementById('secActBtn');
      if (oldButtonContainer) oldButtonContainer.remove();
    
     
    
      const actionUI = createCustomMonthActionUI();
      popup.appendChild(actionUI);
      actionUI.style.display = 'flex';
    }
    


    // ====== UPLOAD PROGRESS DIV CREATION ======
      function createUploadProgressDiv() {
        // Inject blinking dot CSS only once
        if (!document.getElementById('blinking-dot-style')) {
          const style = document.createElement('style');
          style.id = 'blinking-dot-style';
          style.innerHTML = `
            .dot {
              width: 6px;
              height: 6px;
              background-color: #333;
              border-radius: 50%;
              animation: blink 1s infinite;
            }
            .dot:nth-child(2) { animation-delay: 0.2s; }
            .dot:nth-child(3) { animation-delay: 0.4s; }
      
            @keyframes blink {
              0%, 80%, 100% { opacity: 0; }
              40% { opacity: 1; }
            }
          `;
          document.head.appendChild(style);
        }
      
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.padding = '16px';
        container.style.borderRadius = '12px';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.fontFamily = 'Arial, sans-serif';
        
        // Top span with icons and blinking dots
        const iconRow = document.createElement('span');
        iconRow.style.display = 'flex';
        iconRow.style.alignItems = 'center';
        iconRow.style.gap = '12px';
        iconRow.style.fontSize = '24px';
      
        const icon1 = document.createElement('i');
        icon1.className = 'fi fi-rr-document';
      
        const icon2 = document.createElement('i');
        icon2.className = 'fi fi-rr-folder-open';
      
        const dots = document.createElement('span');
        dots.style.display = 'flex';
        dots.style.gap = '4px';
        dots.id = 'blinkingDotsSpan';
        dots.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
      
        iconRow.appendChild(icon1);
        iconRow.appendChild(dots);
        iconRow.appendChild(icon2);
      
        // Bottom span with progress label and bar
        const progressSpan = document.createElement('span');
        progressSpan.style.width = '100%';
        progressSpan.style.marginTop = '12px';
        progressSpan.style.display = 'flex';
        progressSpan.style.flexDirection = 'column';
        progressSpan.style.alignItems = 'center';
      
        const progressText = document.createElement('div');
        progressText.id = 'uploadProgressText';
        progressText.style.fontSize = '12px';
        progressText.style.fontWeight = 'bold';
        progressText.style.marginBottom = '6px';
        progressText.innerText = `Total Leads: ${accumulatedData ? accumulatedData.length : 0} | Uploaded: 0 | 0%`;
        
        const progressBar = document.createElement('div');
        progressBar.style.height = '8px';
        progressBar.style.width = '80%';
        progressBar.style.background = '#eee';
        progressBar.style.borderRadius = '4px';
        progressBar.innerHTML = `
        <div id="progressInner" style="
          width: 0%;
          height: 100%;
          background: linear-gradient(to right, #4caf50, #8bc34a);
          border-radius: 4px;
          transition: width 0.4s ease;"></div>
      `;
      
        progressSpan.appendChild(progressText);
        progressSpan.appendChild(progressBar);

        // Upload Control Buttons container
        const controlBtns = document.createElement('div');
        controlBtns.style.display = 'flex';
        controlBtns.style.gap = '10px';
        controlBtns.style.marginTop = '15px';
        
        const pauseBtn = document.createElement('button');
        pauseBtn.id = 'pauseUploadBtn';
        pauseBtn.innerText = '⏸ Pause';
        Object.assign(pauseBtn.style, { padding: '5px 10px', borderRadius: '5px', border: '1px solid #ff9800', background: '#fff3e0', color: '#e65100', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' });
        
        const resumeBtn = document.createElement('button');
        resumeBtn.id = 'resumeUploadBtn';
        resumeBtn.innerText = '▶ Resume';
        Object.assign(resumeBtn.style, { display: 'none', padding: '5px 10px', borderRadius: '5px', border: '1px solid #4caf50', background: '#e8f5e9', color: '#2e7d32', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' });
        
        const restartBtn = document.createElement('button');
        restartBtn.id = 'restartUploadBtn';
        restartBtn.innerText = '🔄 Restart';
        Object.assign(restartBtn.style, { display: 'none', padding: '5px 10px', borderRadius: '5px', border: '1px solid #2196f3', background: '#e3f2fd', color: '#0d47a1', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' });
        
        controlBtns.append(pauseBtn, resumeBtn, restartBtn);

        // Summary Div
        const summaryDiv = document.createElement('div');
        summaryDiv.id = 'uploadSummaryDiv';
        Object.assign(summaryDiv.style, {
          display: 'none',
          fontSize: '12px',
          marginTop: '10px',
          padding: '8px',
          background: '#f5f5f5',
          borderRadius: '5px',
          textAlign: 'center',
          fontWeight: 'bold',
          width: '90%'
        });

        pauseBtn.addEventListener('click', () => {
          chrome.runtime.sendMessage({ type: 'PAUSE_UPLOAD' });
          pauseBtn.style.display = 'none';
          resumeBtn.style.display = 'block';
          restartBtn.style.display = 'block';
          summaryDiv.style.display = 'block';
          summaryDiv.style.color = '#e65100';
          summaryDiv.style.background = '#fff3e0';
          
          const textEl = document.getElementById('uploadProgressText');
          const currentText = textEl ? textEl.innerText.replace(' | ', '\n') : '';
          summaryDiv.innerText = `Paused.\n${currentText}`;
          dots.style.display = 'none'; // hide blinking dots
        });
        
        resumeBtn.addEventListener('click', () => {
          chrome.runtime.sendMessage({ type: 'RESUME_UPLOAD' });
          pauseBtn.style.display = 'block';
          resumeBtn.style.display = 'none';
          restartBtn.style.display = 'none';
          summaryDiv.style.display = 'none';
          dots.style.display = 'flex';
        });
        
        restartBtn.addEventListener('click', () => {
          chrome.runtime.sendMessage({ type: 'RESTART_UPLOAD' });
          pauseBtn.style.display = 'block';
          resumeBtn.style.display = 'none';
          restartBtn.style.display = 'none';
          summaryDiv.style.display = 'none';
          dots.style.display = 'flex';
          updateProgress(0, 0, accumulatedData.length); // reset UI immediately
        });
      
        container.appendChild(iconRow);
        container.appendChild(progressSpan);
        container.appendChild(summaryDiv);
        container.appendChild(controlBtns);
      
        return container;
      }
      


    // ====== UI Component Function ======
    
const createCustomMonthActionUI = () => {
    const container = document.createElement('div');
    container.id = 'customMonthActions';
    Object.assign(container.style, {
      display: 'flex',
      width: '100%',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '10px',
      marginTop: '10px',
      borderTop: '1px solid #bcbcbc',
    });
  
    const instruction = document.createElement('p');
    instruction.id = 'dateInstruction';
    instruction.innerText = 'Please Select date';
    instruction.style.marginTop = '15px';
    instruction.style.marginBottom = '2px';
    instruction.style.fontSize = '16px';
    instruction.style.fontWeight = 'bold';
    container.appendChild(instruction);
  
    const buttonRow = document.createElement('div');
    Object.assign(buttonRow.style, {
      display: 'flex',
      gap: '10px',
    });
  
    const buttons = ['Start Extracting', 'Back to Home'];
    buttons.forEach(label => {
      const btn = document.createElement('button');
      btn.innerText = label;
      Object.assign(btn.style, {
        
        padding: '6px 12px',
        border: '1px solid #ccc',
        borderRadius: '5px',
        cursor: 'pointer',
        background: '#fff',
        fontSize: '12px',
        color: '#0065b3',
        marginBottom: '10px',
        fontWeight: 'bold',
        transition: 'all 0.2s ease'
      });
  
     
      btn.addEventListener('mouseover', () => {
        btn.style.background = '#0065b3';
        btn.style.color = '#fff';
      });
      btn.addEventListener('mouseout', () => {
        btn.style.background = '#fff';
        btn.style.color = '#0065b3';
      });
  
      btn.addEventListener('click', () => {
        console.log(`${label} clicked`);
  
        if (label === 'Start Extracting') {
          const fromDate = document.getElementById('from_date1')?.value;
          const toDate = document.getElementById('to_date1')?.value;

  
          if (fromDate && toDate) {
            extractRenewalTableData(); // ✅ Run function
            const customUI = document.getElementById('customMonthActions');
            if (customUI) customUI.remove();
            

          } else {
            const instructionText = document.getElementById('dateInstruction');
            if (instructionText) instructionText.innerText = 'Please select both dates first';
          }
        }
  
        if (label === 'Back to Home') {
          const popup = document.getElementById('my-dashboard-popup');
        
  
          const customUI = document.getElementById('customMonthActions');
          if (customUI) customUI.remove();

                          // 👉 Also trigger click on sidebar's "Dashboard" <a> element
                          const dashboardLink = document.querySelector('.side_dash_navigation .dropdown11');
                          if (dashboardLink) dashboardLink.click();
                          document.getElementById('sidebarwrapper')?.classList.remove('toggled');
                          document.getElementById('sideBackdrop')?.classList.remove('backdrop1');
                          
                      
                          // 🚀 Create and show new button container
                          const actionUI = createButtonContainer();
                          popup.appendChild(actionUI);
                          actionUI.style.display = 'flex';
        }
      });
  
      buttonRow.appendChild(btn);
    });
  
    container.appendChild(buttonRow);
    return container;
  };



    // ====== MAIN POPUP CREATION ======
    const createPopup = () => {
      const popup = document.createElement('div');
      popup.id = 'my-dashboard-popup';
      Object.assign(popup.style, {
        position: 'fixed', top: '20px', right: '20px', background: '#fff', color: '#303030',
        padding: '10px', cursor: 'pointer', borderRadius: '10px', border: '1px solid #bcbcbc',
        zIndex: '9999', boxShadow: '0 0 10px rgba(187, 187, 187, 0.5)', fontFamily: 'sans-serif',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        minWidth: '350px', maxWidth: '350px', height: 'auto', transition: 'height 0.5s ease',
      });
  
      popup.appendChild(createTopBar(popup));
  
      const greet = document.createElement('span');
      greet.innerText = 'Welcome to the Dashboard!';
      greet.style.fontSize = '12px';
  
      const nameSpan = document.createElement('span');
      nameSpan.id = 'agentName';
      Object.assign(nameSpan.style, {
        fontWeight: 'bold', color: '#0065b3', fontSize: '18px'
      });
      nameSpan.innerText = 'Fetching name...';
  
      const buttonContainer = createButtonContainer(popup);
      const spinner = createSpinner();
  
      popup.append(greet, nameSpan, buttonContainer, spinner);
      document.body.appendChild(popup);
      return { popup, nameSpan, spinner, buttonContainer };
    };
  
    // ====== DRAGGABLE SUPPORT ======
    const makeDraggable = (popup, dragHandle) => {
      dragHandle.addEventListener('mousedown', (e) => {
        const offsetX = e.clientX - popup.offsetLeft;
        const offsetY = e.clientY - popup.offsetTop;
  
        const onMouseMove = (e) => {
          popup.style.left = `${e.clientX - offsetX}px`;
          popup.style.top = `${e.clientY - offsetY}px`;
          popup.style.right = 'auto';
        };
  
        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };
  
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    };
    
  
    // ====== DASHBOARD HANDLERS ======
    const tryClickProfile = (nameSpan, spinner, buttonContainer) => {
      const profileLink = [...document.querySelectorAll('a')].find(a => a.textContent.trim() === 'My Profile');
      if (!profileLink) return nameSpan.innerText = 'Profile link not found.';
      profileLink.click();
  
      setTimeout(() => {
        const nameHeader = document.querySelector('h5.Prof_holder');
        if (nameHeader) {
          nameSpan.innerText = nameHeader.textContent.trim();
          spinner.style.display = 'none';
          buttonContainer.style.display = 'flex';
  
          const dashboardLink = [...document.querySelectorAll('a')].find(a => a.textContent.trim() === 'Dashboard');
          dashboardLink?.click();
        } else {
          nameSpan.innerText = 'Name not found.';
        }
      }, 1500);
    };
  

    const handleCurrentMonthClick = () => {
      
      const popup = document.getElementById('my-dashboard-popup');

        if (!popup) return console.log('Popup element not found.');


        const buttonContainer = document.getElementById('mainActBtn');
         if (buttonContainer) buttonContainer.remove();

      
        popup.style.maxHeight = '500px';
        const proposalBtn = document.querySelector('.button.view_proposals_btn');
        if (!proposalBtn) return console.log('Proposal link not found.');
      
        proposalBtn.click();
        const spinner = createSpinner();  // Assuming createSpinner is defined elsewhere
        popup.appendChild(spinner);
      
        setTimeout(() => {
          const currYearButton = document.querySelector('#currYear');
          if (currYearButton) {
            currYearButton.click();
          }
      
          setTimeout(() => {
            extractRenewalTableData();  // Assuming extractRenewalTableData is defined elsewhere
            spinner.remove();
          
          }, 1500);
        }, 1000);
      };



      // Main Handler Function
const handleCustomMonthClick = () => {

    const popup = document.getElementById('my-dashboard-popup');

    popup.style.maxHeight = '500px';
  
    const buttonContainer = document.getElementById('mainActBtn');
    if (buttonContainer) buttonContainer.remove();

  
    const spinner = createSpinner(); // Assumes createSpinner is defined
    popup.appendChild(spinner);
  
    setTimeout(() => {
      spinner.remove();
  
      const customUI = createCustomMonthActionUI();
      popup.appendChild(customUI);
    }, 3000);
  
    const proposalBtn = document.querySelector('.button.view_proposals_btn');
    proposalBtn?.click();
  };
  
      

      
    // ====== TABLE DATA EXTRACTOR ======
    let tableData = [];  // Make tableData global
    let accumulatedData = [];


    const extractRenewalTableData = () => {

      // PREVENT MULTIPLE CONCURRENT EXTRACTIONS
      if (document.getElementById('liveExtractModal')) {
         console.warn('-- Extraction is already running --');
         return;
      }

      // Cleanup old completed modals if user starts a totally fresh run
      const oldCompleted = document.querySelectorAll('#completedExtractModal');
      oldCompleted.forEach(m => m.remove());

      const spinner = createSpinner();
      const popup = document.getElementById('my-dashboard-popup');  
      if (popup) {
        popup.appendChild(spinner);
        
        // 🚀 Add Live Extraction Modal
        const extModal = document.createElement('div');
        extModal.id = 'liveExtractModal';
        Object.assign(extModal.style, {
          marginTop: '10px', width: '100%', padding: '10px', 
          background: '#e3f2fd', border: '1px solid #90caf9', 
          borderRadius: '8px', textAlign: 'center', fontFamily: 'sans-serif',
          boxSizing: 'border-box'
        });
        extModal.innerHTML = `
           <h4 style="margin:0 0 8px 0; color:#1565c0; font-size:14px;">Extracting Leads...</h4>
           <div style="font-size:12px; color:#333; line-height:1.5;">
              <p style="margin:0;">Current Page: <b id="liveExtPage">1</b></p>
              <p style="margin:0;">Rows Found: <b id="liveExtRows">0</b></p>
              <p style="margin:0;">Total Extracted: <b id="liveExtTotal">0</b></p>
           </div>
        `;
        popup.appendChild(extModal);
        
      } else {
        console.warn('Popup not found!');
        return;
      }

      setTimeout(() => {
        const table = document.querySelector('.proposalDetails-tbl');
        if (!table) {
          console.log('Renewal table not found.');
          return;
        }
    
        tableData = []; // reset data
        const headerElements = table.querySelectorAll('thead tr th');
        let headers = [];
    
        // Extract headers
        headerElements.forEach(header => {
          let key = header.textContent.trim().toUpperCase().replace(/\s+/g, '_');
          if (key !== 'ACTION') headers.push(key);
        });
        headers.push('AGENT_NAME');
    
        function extractTableData() {
          // MUST query from document again because SPA redraws the entire table component on page change
          const currentTable = document.querySelector('.proposalDetails-tbl');
          if (!currentTable) return;
          
          const rows = currentTable.querySelectorAll('tbody tr');
          const agentName = document.getElementById('agentName')?.textContent.trim() || 'UNKNOWN';
    
          rows.forEach((row) => {
            const cells = row.querySelectorAll('td');
            const rowData = {};
            let cellCounter = 0;
            
            // Note: headers array is computed once globally, which is fine since columns don't change
            cells.forEach((cell, cellIndex) => {
              // Ensure we fallback gracefully if headers are misaligned 
              if (headers[cellCounter]) {
                const key = headers[cellCounter];
                rowData[key] = cell.textContent.trim();
                cellCounter++;
              }
            });
    
            rowData['AGENT_NAME'] = agentName;
            tableData.push(rowData);
          });
          
          // 💡 Live Update Modal Data
          const liveExtRows = document.getElementById('liveExtRows');
          const liveExtTotal = document.getElementById('liveExtTotal');
          if (liveExtRows) liveExtRows.innerText = rows.length;
          if (liveExtTotal) liveExtTotal.innerText = tableData.length;
        }
        // Initial setup for the loop
        let currentPageNum = 1;

        function finishExtractionSuccess() {
            console.log('Finished extracting all pages.');
            const copiedData = JSON.parse(JSON.stringify(tableData));

            // Add and remove duplicates
            copiedData.forEach(row => {
              const isDuplicate = accumulatedData.some(existing => JSON.stringify(existing) === JSON.stringify(row));
              if (!isDuplicate) accumulatedData.push(row);
            });
            
            console.log('📦 All accumulated data', accumulatedData);
            processData(accumulatedData);
            
            const popup = document.getElementById('my-dashboard-popup');
            
            // Show FINAL SUCCESSRESULT and change ID to prevent blocking next extraction
            const liveModal = document.getElementById('liveExtractModal');
            if (liveModal) {
               liveModal.id = 'completedExtractModal';
               liveModal.style.background = '#e8f5e9'; // Light green
               liveModal.style.borderColor = '#81c784';
               liveModal.innerHTML = `
                  <h4 style="margin:0 0 8px 0; color:#2e7d32; font-size:16px;">Extraction Complete!</h4>
                  <div style="font-size:13px; color:#333; line-height:1.6; font-weight:bold;">
                     <p style="margin:0;">Total Pages Scanned: <span style="color:#1565c0;">${currentPageNum}</span></p>
                     <p style="margin:0;">Total Leads Extracted: <span style="color:#d32f2f;">${accumulatedData.length}</span></p>
                  </div>
               `;
            }
    
            let messageDiv = document.getElementById('messageDiv');
            if (!messageDiv) createDataUi();
    
            const secondaryButtonContainer = createSecondaryButtonContainer();
            popup.appendChild(secondaryButtonContainer);
            secondaryButtonContainer.style.display = 'block';

            setTimeout(() => spinner.remove(), 1000);
        }

        function pauseExtractionWithError(errorMsg, failedPage) {
            console.error(`Extraction paused: ${errorMsg}`);
            const liveModal = document.getElementById('liveExtractModal');
            if (liveModal) {
               liveModal.style.background = '#ffebee';
               liveModal.style.borderColor = '#ef5350';
               liveModal.innerHTML = `
                  <h4 style="margin:0 0 8px 0; color:#c62828; font-size:14px;">⚠️ Extraction Paused (Error)</h4>
                  <div style="font-size:12px; color:#333; line-height:1.5;">
                     <p style="margin:0; color:#d32f2f;"><b>Error:</b> ${errorMsg}</p>
                     <p style="margin:4px 0 0 0;">Failed at Page: <b>${failedPage}</b></p>
                     <p style="margin:2px 0;">Total Extracted So Far: <b>${tableData.length}</b></p>
                  </div>
                  <div id="errBtns" style="margin-top:10px; display:flex; justify-content:center; gap:10px;">
                    <button id="resumeExtBtn" style="padding:5px 10px; background:#4caf50; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">▶ Retry / Resume</button>
                    <button id="cancelExtBtn" style="padding:5px 10px; background:#424242; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">⏹ Finish Here</button>
                  </div>
               `;
               
               document.getElementById('resumeExtBtn').addEventListener('click', () => {
                  // Restore visually original extracting UI
                  liveModal.style.background = '#e3f2fd';
                  liveModal.style.borderColor = '#90caf9';
                  liveModal.innerHTML = `
                     <h4 style="margin:0 0 8px 0; color:#1565c0; font-size:14px;">Extracting Leads...</h4>
                     <div style="font-size:12px; color:#333; line-height:1.5;">
                        <p style="margin:0;">Current Page: <b id="liveExtPage">${currentPageNum}</b></p>
                        <p style="margin:0;">Rows Found: <b id="liveExtRows">0</b></p>
                        <p style="margin:0;">Total Extracted: <b id="liveExtTotal">${tableData.length}</b></p>
                     </div>
                  `;
                  // Re-try extracting by firing processNextPage again
                  processNextPage();
               });
               
               document.getElementById('cancelExtBtn').addEventListener('click', () => {
                  finishExtractionSuccess();
               });
            }
        }

        function processNextPage() {
          // STEP 1: Extract current data physically present on the screen
          extractTableData();

          // STEP 2: Find the NEXT page button directly
          const nextPageNum = currentPageNum + 1;
          const paginationLinks = document.querySelectorAll('.pagination .page-item a.page-link');
          
          let nextButton = null;
          for (let i = 0; i < paginationLinks.length; i++) {
             if (paginationLinks[i].textContent.trim() === String(nextPageNum)) {
                nextButton = paginationLinks[i];
                break;
             }
          }

          // STEP 3: If no next button exists, extraction is completely finished
          if (!nextButton) {
            finishExtractionSuccess();
            return;
          }

          // STEP 4: Move to next page if available
          console.log(`Moving to Page ${nextPageNum}...`);
            
          const tbodyBefore = document.querySelector('.proposalDetails-tbl tbody');
          const contentBefore = tbodyBefore ? tbodyBefore.innerText.trim() : '';

          nextButton.click();

          // STEP 5: Wait actively for the new table data to physically appear
          let attempts = 0;
          const checkDataLoaded = setInterval(() => {
            attempts++;
            const tbodyNow = document.querySelector('.proposalDetails-tbl tbody');
            const contentNow = tbodyNow ? tbodyNow.innerText.trim() : '';
            const trCount = tbodyNow ? tbodyNow.querySelectorAll('tr').length : 0;
            
            const isDifferent = contentNow !== contentBefore;
            const isNotLoadingState = trCount > 0 && !contentNow.toLowerCase().includes('loading');
            
            // Proceed only when data matches safe condition or timeout hits 15 seconds (30 attempts)
            if ((isDifferent && isNotLoadingState) || attempts > 30) {
              clearInterval(checkDataLoaded);
              
              if (attempts > 30) {
                 // The website failed to load the next page in 15 seconds! Throw an interactive error.
                 pauseExtractionWithError('Timeout waiting for the page to load. Please check your internet connection.', nextPageNum);
                 return; // Halt the loop
              }
              
              // Grace period for React to stabilize the DOM
              setTimeout(() => {
                currentPageNum = nextPageNum;
                
                const livePage = document.getElementById('liveExtPage');
                if (livePage) livePage.innerText = currentPageNum;
                
                // Recursively repeat for the newly loaded page!
                processNextPage();
              }, 1000); 
            }
          }, 500);
        }
    
        // Start the infinite loop engine
        processNextPage();
      }, 3000);

    };


    // ====== SEND DATA TO APPSCRIPT ======
    function sendDataToAppScript() {

      const buttonContainer = document.getElementById('secActBtn');
      if (buttonContainer) {
        buttonContainer.style.display = 'none';
      }

      if (!tableData || tableData.length === 0) {
        console.warn('No table data to send.');
        return;
      }

    
      const messageDiv = document.getElementById('messageDiv');
      if (!messageDiv) {
        console.warn('messageDiv not found!');
        return;
      }

      
      if (messageDiv) {
        messageDiv.innerHTML = ''; // Clear the existing content
      }
    
      // Clear existing progress divs if any
      const existingProgress = document.getElementById('progressInner');
      if (existingProgress) {
        existingProgress.closest('div').remove();
      }
    
      // Create and append new upload progress UI
      const uploadProgressDiv = createUploadProgressDiv();
      messageDiv.appendChild(uploadProgressDiv);
    
      // Give the DOM some time to paint
      setTimeout(() => {
        updateProgress(0, 0, accumulatedData.length);  // Start from 0%
      }, 100);
    
      // Send data to background
      chrome.runtime.sendMessage({
        type: 'TABLE_DATA',
        payload: accumulatedData
      });
    }
    
    

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'UPLOAD_PROGRESS') {
        updateProgress(message.payload.progressPercent, message.payload.uploadedCount, message.payload.totalCount);
      } else if (message.type === 'UPLOAD_ERROR') {
        handleUploadErrorUI(message.payload);
      } else if (message.type === 'UPLOAD_COMPLETE') {
        updateProgress(100, message.payload.total, message.payload.total);
      }
    });

    function handleUploadErrorUI(payload) {
      const summaryDiv = document.getElementById('uploadSummaryDiv');
      const pauseBtn = document.getElementById('pauseUploadBtn');
      const resumeBtn = document.getElementById('resumeUploadBtn');
      const restartBtn = document.getElementById('restartUploadBtn');
      const dots = document.getElementById('blinkingDotsSpan');
      
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (resumeBtn) resumeBtn.style.display = 'block';
      if (restartBtn) restartBtn.style.display = 'block';
      if (dots) dots.style.display = 'none';

      if (summaryDiv) {
        summaryDiv.style.display = 'block';
        summaryDiv.style.color = '#c62828'; // red
        summaryDiv.style.background = '#ffebee';
        summaryDiv.innerHTML = `⚠️ System Auto Paused.<br>Error at lead index ${payload.index}:<br>${payload.error}<br><br>${payload.uploaded} Passed | ${payload.total - payload.uploaded} Pending`;
      }
    }

    function updateProgress(percent, uploadedCount = 0, totalCount = 0) {
      const inner = document.getElementById('progressInner');
      const progressText = document.getElementById('uploadProgressText');
      const summaryDiv = document.getElementById('uploadSummaryDiv');
      
      if (progressText && totalCount > 0) {
        progressText.innerText = `Total Leads: ${totalCount} | Uploaded: ${uploadedCount} | ${percent}%`;
        
        // If summary is currently showing (e.g. paused) and isn't showing an error, update it too
        if (summaryDiv && summaryDiv.style.display !== 'none' && !summaryDiv.innerHTML.includes('Error')) {
          summaryDiv.innerText = `Paused.\nTotal Leads: ${totalCount}\nUploaded: ${uploadedCount}`;
        }
      }

      if (!inner) return;
    
      inner.style.width = percent + '%';
      console.log(`Progress updated to ${percent}%`);
    
      if (percent === 100) {
        // Listen for transition end
        inner.addEventListener('transitionend', function onTransitionEnd() {
          // Remove listener so it only runs once
          inner.removeEventListener('transitionend', onTransitionEnd);

          const buttonContainer = document.getElementById('secActBtn');
          if (buttonContainer) {
            buttonContainer.style.display = 'block';
          }
    
          // Delay wait before success msg
          setTimeout(() => {
            const messageDiv = document.getElementById('messageDiv');
            if (!messageDiv) return;
    
            messageDiv.innerHTML = ''; // Clear existing content
    
            const successDiv = document.createElement('div');
            successDiv.style.width = '100%';
            successDiv.style.height = '100%';
            successDiv.style.display = 'flex';
            successDiv.style.flexDirection = 'column';
            successDiv.style.alignItems = 'center';
            successDiv.style.justifyContent = 'center';
            successDiv.style.fontFamily = 'Arial, sans-serif';
    
            // Animated check icon
            const checkIcon = document.createElement('i');
            checkIcon.className = 'fi fi-br-check animated-check';
            checkIcon.style.fontSize = '28px';
    
            // Inject animation CSS once
            if (!document.getElementById('check-style')) {
              const style = document.createElement('style');
              style.id = 'check-style';
              style.innerHTML = `
                @keyframes bounce {
                  0%, 100% { transform: scale(1); }
                  50% { transform: scale(1.2); }
                }
                .animated-check {
                  animation: bounce 1s ease-in-out infinite;
                  font-size: 48px;
                  color: #4caf50;
                }
              `;
              document.head.appendChild(style);
            }
    
            const messageText = document.createElement('p');
            messageText.innerText = 'Upload Successful';
            messageText.style.fontSize = '20px';
            messageText.style.color = '#4caf50';
            messageText.style.marginTop = '5px';
    
            successDiv.appendChild(checkIcon);
            successDiv.appendChild(messageText);
            messageDiv.appendChild(successDiv);
          }, 500); // Delay after transition ends
        });
      }
    }
    
    
    

    
      
    // ====== TABLE RENDERING ======

    const renderExtractedTable = () => {
      const messageDiv = document.getElementById('messageDiv');
      if (!messageDiv) {
        console.warn('messageDiv not found!');
        return;
      }
    
      messageDiv.innerHTML = ''; // Clear existing content
    
      // Create and append style if not already present
      if (!document.getElementById('customTableStyle')) {
        const style = document.createElement('style');
        style.id = 'customTableStyle';
        style.textContent = `
          @import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap');
          .custom-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px !important;  
            font-family: 'Roboto', sans-serif;
            position: relative;
          }
          .custom-table th, .custom-table td {
            padding: 8px 10px;
            text-align: center;
            font-style: italic;
            white-space: nowrap;
            border-bottom: 1px solid #bcbcbc;
            color:rgb(114, 114, 114);
          }
          .custom-table th {
            background: #0065b3;
            color: #fff;
            font-weight: bold;
            position: sticky;
            top: 0;
            z-index: 1;
          }
          #dataTable {
            max-height: 300px;
            overflow: auto;
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE and Edge */
          }
          #dataTable::-webkit-scrollbar {
            display: none; /* Chrome, Safari */
          }
        `;
        document.head.appendChild(style);
      }
    
      // Create inner container
      const container = document.createElement('div');
      container.id = 'dataTable';
      container.style.overflow = 'auto';
      container.style.maxHeight = '300px';
      messageDiv.appendChild(container);
      messageDiv.style.display = 'block';
    
      if (!Array.isArray(accumulatedData) || accumulatedData.length === 0) {
        container.textContent = 'No data available.';
        return;
      }
    
      // Determine valid keys (remove keys with all undefined values or that are themselves undefined)
      const validKeys = Object.keys(accumulatedData[0]).filter(key =>
        key !== 'undefined' &&
        accumulatedData.some(row => row[key] !== undefined && row[key] !== null)
      );
    
      // Build the table
      const table = document.createElement('table');
      table.className = 'custom-table';
    
      // Build thead
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
    
      // Add Sno. header
      const snoTh = document.createElement('th');
      snoTh.textContent = 'Sno.';
      headerRow.appendChild(snoTh);
    
      // Add other valid headers
      validKeys.forEach(key => {
        const th = document.createElement('th');
        th.textContent = key.replace(/_/g, ' ');
        headerRow.appendChild(th);
      });
    
      thead.appendChild(headerRow);
      table.appendChild(thead);
    
      // Build tbody
      const tbody = document.createElement('tbody');
      accumulatedData.forEach((row, index) => {
        const tr = document.createElement('tr');
    
        // Add serial number
        const snoTd = document.createElement('td');
        snoTd.textContent = index + 1;
        tr.appendChild(snoTd);
    
        // Add valid data cells
        validKeys.forEach(key => {
          const td = document.createElement('td');
          td.textContent = row[key] ?? ''; // fallback to empty string
          tr.appendChild(td);
        });
    
        tbody.appendChild(tr);
      });
    
      table.appendChild(tbody);
      container.appendChild(table);
    };
    



  
    // ====== MAIN RUNNER ======
    const runPopup = () => {
      if (window.location.href === 'https://faveo.careinsurance.com/NewFaveo/#/portal/dashboard') {
        if (!document.getElementById('my-dashboard-popup')) {
          const { popup, nameSpan, spinner, buttonContainer } = createPopup();
          addSpinnerStyle();
          setTimeout(() => tryClickProfile(nameSpan, spinner, buttonContainer), 500);
        }
      }
    };
    
    // Run again when the URL hash changes (for hash-based SPA routing)
    window.addEventListener('hashchange', runPopup);
    
    // Optional: also listen to popstate in case routing isn't purely hash-based
    window.addEventListener('popstate', runPopup);
    
    // Fallback: periodically check the URL every second (useful in stubborn SPAs)
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        runPopup();
      }
    }, 1000);
    
  
    loadIconCDN();
    runPopup();
  
  })();
  