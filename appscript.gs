function normalizeKeys(obj) {
  const normalized = {};
  for (let key in obj) {
    if (key && key.trim()) {
      const cleanKey = key.trim().toUpperCase().replace(/\.+$/, ''); // Remove trailing dots
      normalized[cleanKey] = obj[key];
    }
  }
  return normalized;
}

function doPost(e) {
  try {
    const action = e.parameter.action;

    // 🔐 [NEW] Handle Password Updates from the Extension
    if (action === 'update_password') {
      const payload = JSON.parse(e.postData.contents);
      const userId = String(payload.userId).trim();
      const newPassword = String(payload.newPassword).trim();
      
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName("meta_data"); // 📝 Updated to your sheet name
      if (!sheet) sheet = ss.getSheets()[0]; 
      
      const values = sheet.getDataRange().getValues();
      let found = false;
      
      for (let i = 0; i < values.length; i++) {
        // Search Column A (agent_id)
        if (String(values[i][0]).trim() === userId) {
          sheet.getRange(i + 1, 3).setValue(newPassword); // 🔑 Update Column C (agent_password)
          found = true;
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ 
        success: found, 
        message: found ? "Password updated successfully" : "User ID not found in sheet" 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 📊 [EXISTING] Handle Extension Extraction Data Chunks
    const rawData = JSON.parse(e.parameter.data);
    const normalizedData = rawData.map(row => normalizeKeys(row));
    const sheet = SpreadsheetApp.openById('1_dRoBB-cyu5xhzxBZvJPc59OOiHJiTACK6wIs_iNRLk').getSheetByName('data');
    
    let lastRow = sheet.getLastRow(); // Change 'const' to 'let'

    // If the sheet is empty (just the header), we start with row 2
    if (lastRow < 2) {
      lastRow = 2;
    }

    // Get all existing Proposal Nos from Column A (this checks if any cell is empty in the column)
    const existingProposalNos = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
    const proposalRowMap = {}; // Map proposalNo -> rowIndex (1-based)

    existingProposalNos.forEach((p, i) => {
      if (p.toString().trim()) {
        proposalRowMap[p.toString().trim()] = i + 2; // +2 because data starts from row 2
      }
    });

    let insertedCount = 0;
    let updatedCount = 0;

    normalizedData.forEach(row => {
      const proposalNo = row['PROPOSAL_NO']?.toString().trim();

     // Get current IST timestamp in DD:MM:YY Hh:mm:ss format
const now = new Date();
const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
const formattedTime = Utilities.formatDate(istTime, "Asia/Kolkata", "dd-MM-yy HH:mm:ss");

// Construct row with timestamp at column 13
const rowData = [
  row['PROPOSAL_NO'],
  row['CUSTOMER_NAME'],
  row['PAYMENT_AMOUNT'],
  row['GWP'],
  row['LOGIN_DATE'],
  row['PROPOSAL_STATUS'],
  row['POLICY_NO'],
  row['POLICY_START_DATE'],
  row['NO._OF_LIVES'],
  row['BUSINESS_TYPE'],
  row['PLAN'],
  row['AGENT_NAME'],
  formattedTime // Column 13 (M): Last Update Timestamp
];

      if (proposalNo) {
        // If Proposal No exists and is found in existing rows
        if (proposalRowMap[proposalNo]) {
          const rowIndex = proposalRowMap[proposalNo];
          // Check if the row index exists before updating
          if (rowIndex >= 2) {
            sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
            updatedCount++;
          }
        } else {
          // If Proposal No is not found, add as new entry
          sheet.appendRow(rowData);
          insertedCount++;
        }
      } else {
        // If Proposal No is empty, directly append this entry as new
        sheet.appendRow(rowData);
        insertedCount++;
      }
    });

    removeProposalRow();
    updatePaymentResponses();
    

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      inserted: insertedCount,
      updated: updatedCount
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }


}


function removeProposalRow() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();  
  var sheet = ss.getSheetByName("data"); // <-- अपनी sheet का नाम डालें
  var data = sheet.getRange("A:A").getValues(); // Column A ka pura data

  var proposalNo = "1120122352262";

  for (var i = data.length - 1; i >= 0; i--) {  // उल्टा loop ताकि delete के बाद index गड़बड़ न हो
    if (data[i][0] == proposalNo) {
      sheet.deleteRow(i + 1);  // row index 1-based होता है
    }
  }
}



function updatePaymentResponses() {
  const sourceSheet = SpreadsheetApp.openById('1_dRoBB-cyu5xhzxBZvJPc59OOiHJiTACK6wIs_iNRLk').getSheetByName('Data');
  const targetSheet = SpreadsheetApp.openById('1qzxbyavzNWD9x-hG5y6cNFZlMEMyubOR-JAN5-spWiA').getSheetByName('Payment_Responses');
  
  const sourceData = sourceSheet.getDataRange().getValues();
  const paymentValues = targetSheet.getRange('W:W').getValues(); // Column W
  
  const paymentMap = {};
  for (let i = 0; i < paymentValues.length; i++) {
    const val = paymentValues[i][0];
    if (val) paymentMap[val] = i + 1; // 1-based row index
  }

  const yellowStatuses = [
    'Pending UW requirement', 
    'Primary:Branch CPU Resolution',
    'Primary:Pending Underwriting Review',
    'Primary:Pending Tele Q',
    'Primary:Pending Underwriting',
    'Primary:Payment not cleared',
    'Primary:Pending UW requirement',
    'Primary:Payment Entry Task',
    'Primary:Pending Tele QSecondary:Customer Response Pending',
    'Primary:Counter Offer Confirmation Task',
    'Primary:At Branch',
    'Primary:Pending UnderwritingSecondary:BOT Completed',
    'Primary:Pending CPU Requirement',
    'Primary:Payment not cleared',
    'Primary:Payment Entry Task',
    'Primary:Counter Offer Confirmation Task'
    
  ];

  const greenStatuses = [
    'Inforce',
    'Primary:InforceSecondary:BOT Failed',
    'Primary:InforceSecondary:Pending',
    'Primary:InforceSecondary:Non Disclosure',
    'Primary:InforceSecondary:ND - Counter Offer Member',
    'Primary:InforceSecondary:AUTHORISED'

  ];

  const redStatuses = [
    'Primary:Mark for Cancellation Task',
    'Primary:Declined',
    'Primary:DeclinedSecondary:AUTHORISED',
    'Primary:Cancelled',
    'Primary:DeclinedSecondary:Pending',
    'Primary:CancelledSecondary:PENDING',
    'Primary:DeclinedSecondary:PENDING',
    'Primary:DeclinedSecondary:Tele Underwriting Scheduled',
    'Primary:DeclinedSecondary:Customer Response Pending',
    'Primary:CancelledSecondary:AUTHORISED'
  ];

  for (let i = 0; i < sourceData.length; i++) {
    const columnA = sourceData[i][0]; // Column A (matching key)
    const columnI = sourceData[i][5]; // Column I (status)
    const columnF = sourceData[i][5]; // Column F (data to write in AG)

    if (paymentMap[columnA]) {
      const row = paymentMap[columnA];
      let color = null;

      if (greenStatuses.includes(columnI)) {
        color = 'green';
      } else if (yellowStatuses.includes(columnI)) {
        color = 'yellow';
      } else if (redStatuses.includes(columnI)) {
        color = 'red';
      }

      if (color) {
        targetSheet.getRange(row, 23).setBackground(color); // Set background color in column W
      }

      // ✅ Update column AG (33) with value from columnF
      targetSheet.getRange(row, 34).setValue(columnF);

      // ✅ Add current timestamp to column AH (34)
      const now = new Date();
      const formattedDate = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd-MM-yy HH:mm:ss');
      targetSheet.getRange(row, 35).setValue(formattedDate);
    }
  }
}
