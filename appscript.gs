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

// 🔐 [IMPORTANT] Run this function manually once in the Apps Script Editor to grant permissions!
function authorizeMail() {
  MailApp.sendEmail("thefinancialcraft@gmail.com", "Auth Test", "Authorization Success");
  console.log("✅ Mail permissions granted.");
}

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'check_auth') {
    const extId = String(e.parameter.extId).trim();
    const userEmailInput = e.parameter.email ? String(e.parameter.email).trim().toLowerCase() : null;
    console.log(`🔍 [CHECK AUTH] ExtID: ${extId}, EmailInput: ${userEmailInput}`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("user_data");
    if (!sheet) {
      console.error('❌ [CHECK AUTH] user_data sheet NOT FOUND');
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'user_data sheet missing' })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toUpperCase());
    console.log(`🔍 [DEBUG] Headers Detected: ${JSON.stringify(headers)}`);

    const idx = {
      EXT_ID: headers.indexOf('EXTENSION_ID'),
      NAME: headers.indexOf('USER_NAME'),
      EMAIL: headers.indexOf('USER_EMAIL'),
      STATUS: headers.indexOf('STATUS'),
      IS_ADMIN: headers.indexOf('IS_ADMIN'),
      PROFILE: headers.indexOf('PROFILE_VISIBLE'),
      RENEWAL: headers.indexOf('RENEWAL_VISIBLE'),
      ACCESS: headers.indexOf('AGENT_ACCESS'),
      OTP_REQ: headers.indexOf('OTP_REQUIRED')
    };

    // Check if critical headers are missing
    if (idx.EXT_ID === -1 || idx.OTP_REQ === -1) {
      return ContentService.createTextOutput(JSON.stringify({ 
        success: false, 
        message: 'Critical Column Missing in Sheet (EXTENSION_ID or OTP_REQUIRED)' 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    for (let i = 1; i < data.length; i++) {
      let rowExtId = String(data[i][idx.EXT_ID]).replace(/,/g, '').trim();
      let rowEmail = idx.EMAIL !== -1 ? String(data[i][idx.EMAIL]).trim().toLowerCase() : "";
      let status = idx.STATUS !== -1 ? String(data[i][idx.STATUS]).trim().toLowerCase() : "pending";
      
      // Match ID and Email
      if (rowExtId === extId && (userEmailInput === null || userEmailInput === rowEmail)) {
        console.log(`✅ Found Matching User Record at Row ${i+1}`);
        
        if (status === 'approved') {
          const userName = idx.NAME !== -1 ? data[i][idx.NAME] : 'User';
          const rowEmailFinal = idx.EMAIL !== -1 ? data[i][idx.EMAIL] : "";
          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          
          let valOtpReq = data[i][idx.OTP_REQ];
          let rawOtpReq = (valOtpReq === null || valOtpReq === undefined || valOtpReq === "") ? "" : String(valOtpReq).trim().toUpperCase();
          console.log(`🔍 [DEBUG] Row ${i+1} OTP_REQ Value: "${valOtpReq}", Index: ${idx.OTP_REQ}`);

          if (rawOtpReq !== "TRUE" && rawOtpReq !== "FALSE") {
            return ContentService.createTextOutput(JSON.stringify({ 
              success: false, 
              message: `Invalid Config: 'otp_required' must be TRUE or FALSE. Found: "${rawOtpReq}"`,
              debug: {
                detectedIndex: idx.OTP_REQ,
                fullRow: data[i],
                headers: headers
              }
            })).setMimeType(ContentService.MimeType.JSON);
          }

          let otpRequired = (rawOtpReq === "TRUE"); 

          let userData = {
            extension_id: rowExtId,
            user_name: userName,
            user_email: rowEmailFinal,
            status: status,
            is_admin: idx.IS_ADMIN !== -1 ? String(data[i][idx.IS_ADMIN]).toUpperCase() === "TRUE" : false,
            profile_visible: idx.PROFILE !== -1 ? String(data[i][idx.PROFILE]).toUpperCase() === "TRUE" : false,
            renewal_visible: idx.RENEWAL !== -1 ? String(data[i][idx.RENEWAL]).toUpperCase() === "TRUE" : false,
            agent_access: idx.ACCESS !== -1 ? String(data[i][idx.ACCESS]) : "",
            otp_required: otpRequired
          };

          if (!otpRequired) {
            console.log('⚡ OTP NOT REQUIRED. Authorizing immediately.');
            sheet.getRange(i + 1, 6).setValue(new Date()); 
            return ContentService.createTextOutput(JSON.stringify({ 
              success: true, step: 'AUTHORIZED', userData: userData,
              is_admin: userData.is_admin, profile_visible: userData.profile_visible, renewal_visible: userData.renewal_visible
            })).setMimeType(ContentService.MimeType.JSON);
          }

          // OTP is required
          try {
            console.log(`🚀 Sending OTP ${otp} to ${rowEmailFinal}`);
            MailApp.sendEmail(rowEmailFinal, `[SECURE ACCESS] OTP for Extension Login - ${otp}`, 
              `Hello ${userName},\n\nYour 6-digit code is: ${otp}\n\nSecurely,\nFaveo Security Team`);
            
            sheet.getRange(i + 1, 4).setValue(otp);
            sheet.getRange(i + 1, 6).setValue(new Date());
            
            return ContentService.createTextOutput(JSON.stringify({ 
              success: true, step: 'OTP_SENT', email: rowEmailFinal, userData: userData,
              is_admin: userData.is_admin, profile_visible: userData.profile_visible, renewal_visible: userData.renewal_visible
            })).setMimeType(ContentService.MimeType.JSON);
          } catch (err) {
            console.error('❌ MailApp Error:', err.message);
            return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Mail Error: ' + err.message }));
          }
        } else {
          console.warn(`⏳ Status is '${status}', not 'approved'`);
          return ContentService.createTextOutput(JSON.stringify({ success: false, status: 'pending', message: 'Waiting for Admin Approval' }));
        }
      }
    }
    console.warn('❌ No Matching ID/Email found in sheet');
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'ID or Email mismatch' }));
  }

  // 👑 ACTION: Get All Users (For Admin Panel)
  if (action === 'get_all_users') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("user_data");
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Sheet not found' })).setMimeType(ContentService.MimeType.JSON);
    
    const data = sheet.getDataRange().getValues();
    let users = [];
    
    // Header check: extension_id, user_name, user_email, latest_otp, status, last_login, is_admin, profile_visible, renewal_visible, agent_access
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue; // Skip empty rows
      users.push({
        extension_id: String(data[i][0]).replace(/,/g, ''),
        user_name: String(data[i][1] || ""),
        extension_id: String(data[i][idx.EXT_ID]).replace(/,/g, ''),
        user_name: idx.NAME !== -1 ? String(data[i][idx.NAME] || "") : "",
        user_email: idx.EMAIL !== -1 ? String(data[i][idx.EMAIL] || "") : "",
        status: idx.STATUS !== -1 ? String(data[i][idx.STATUS] || "Pending") : "Pending",
        last_login: idx.LAST_LOGIN !== -1 ? String(data[i][idx.LAST_LOGIN] || "") : "",
        is_admin: idx.IS_ADMIN !== -1 ? String(data[i][idx.IS_ADMIN]).toUpperCase() === "TRUE" : false,
        profile_visible: idx.PROFILE !== -1 ? String(data[i][idx.PROFILE]).toUpperCase() === "TRUE" : false,
        renewal_visible: idx.RENEWAL !== -1 ? String(data[i][idx.RENEWAL]).toUpperCase() === "TRUE" : false,
        agent_access: idx.ACCESS !== -1 ? String(data[i][idx.ACCESS] || "") : "",
        otp_required: (idx.OTP_REQ !== -1 && (data[i][idx.OTP_REQ] === null || data[i][idx.OTP_REQ] === undefined || data[i][idx.OTP_REQ] === "")) ? false : (idx.OTP_REQ !== -1 ? String(data[i][idx.OTP_REQ]).trim().toUpperCase() === "TRUE" : false)
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, users: users })).setMimeType(ContentService.MimeType.JSON);
  }

  // 🔑 ACTION: Verify User OTP
  if (action === 'verify_user_otp') {
    const extId = String(e.parameter.extId).trim();
    const otpInput = String(e.parameter.otp).trim();
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("user_data");
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).replace(/,/g, '').trim() === extId) {
        let storedOtp = String(data[i][3]).trim();
        if (storedOtp === otpInput && otpInput !== "") {
          sheet.getRange(i + 1, 4).setValue(""); // Clear OTP after use
          
          // Construct full user object for frontend decisions
          let userData = {
            extension_id: String(data[i][0]),
            user_name: String(data[i][1]),
            user_email: String(data[i][2]),
            status: String(data[i][4]),
            is_admin: String(data[i][6]).toUpperCase() === "TRUE",
            profile_visible: String(data[i][7]).toUpperCase() === "TRUE",
            renewal_visible: String(data[i][8]).toUpperCase() === "TRUE",
            agent_access: String(data[i][9])
          };

          return ContentService.createTextOutput(JSON.stringify({ 
            success: true,
            userData: userData,
            // Keep these for backward compatibility if needed
            is_admin: userData.is_admin,
            profile_visible: userData.profile_visible,
            renewal_visible: userData.renewal_visible
          })).setMimeType(ContentService.MimeType.JSON);
        }
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Invalid OTP' })).setMimeType(ContentService.MimeType.JSON);
  }

  // 🚀 UNIFIED URL: Fetch Authorized Agents for Specific User
  if (action === 'forlogin') {
    const extId = String(e.parameter.extId).trim();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Get Allowed Agent IDs for this user
    let userSheet = ss.getSheetByName("user_data");
    let allowedIds = [];
    if (userSheet) {
      const userData = userSheet.getDataRange().getValues();
      for (let i = 1; i < userData.length; i++) {
        if (String(userData[i][0]).replace(/,/g, '').trim() === extId) {
          // agent_access is col 10 (index 9)
          let accessStr = String(userData[i][9] || "");
          // Extract numbers (IDs) from the string (handles {209..., 208...} or plain CSV)
          allowedIds = accessStr.match(/\d+/g) || [];
          break;
        }
      }
    }
    
    // 2. Fetch all agents and filter
    let metaSheet = ss.getSheetByName("meta_data");
    if (!metaSheet) metaSheet = ss.getSheets()[0];
    const values = metaSheet.getDataRange().getValues();
    const headers = values[0];
    
    const agents = values.slice(1).map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h.toLowerCase().replace(/ /g, '_')] = row[i]);
      return obj;
    }).filter(agent => {
      // Find Agent ID column (robust check)
      let idKey = Object.keys(agent).find(k => k.includes('agent_id'));
      if (!idKey) return false;
      let agentId = String(agent[idKey]).trim();
      return allowedIds.indexOf(agentId) !== -1;
    });
    
    return ContentService.createTextOutput(JSON.stringify(agents)).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  console.log('🚀 [APPS SCRIPT] Incoming Request:', JSON.stringify(e));
  try {
    const action = e.parameter.action;
    console.log('🎯 [APPS SCRIPT] Action Detected:', action);

    // 🛡️ [NEW] Handle User Registration
    if (action === 'register_user') {
      const payload = JSON.parse(e.postData.contents);
      const extId = String(payload.extId).trim();
      const name = String(payload.name).trim();
      const email = String(payload.email).trim();
      
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName("user_data");
      if (!sheet) {
        sheet = ss.insertSheet("user_data");
        sheet.appendRow(["extension_id", "user_name", "user_email", "latest_otp", "status", "reg_date"]);
      }
      
      const data = sheet.getDataRange().getValues();
      let exists = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === extId) { exists = true; break; }
      }
      
      if (!exists) {
        sheet.appendRow([extId, name, email, "", "Pending", new Date()]);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

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

    // 🔐 [NEW] Handle Admin OTP Sending
    if (action === 'send_admin_otp') {
      const email = "thefinancialcraft@gmail.com";
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      console.log('📨 [APPS SCRIPT] Sending OTP to:', email);
      
      // Store OTP with 3-minute expiry (approximate using timestamp)
      const props = PropertiesService.getScriptProperties();
      props.setProperty('ADMIN_OTP', otp);
      props.setProperty('ADMIN_OTP_TIME', Date.now().toString());
      
      try {
        MailApp.sendEmail({
          to: email,
          subject: "Admin Access OTP - Faveo Extension",
          htmlBody: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #0065b3;">Admin Security Verification</h2>
              <p>Your one-time password (OTP) for admin panel access is:</p>
              <div style="font-size: 32px; font-weight: bold; color: #4caf50; letter-spacing: 5px; margin: 20px 0;">${otp}</div>
             <p style="color: #666; font-size: 12px;">This OTP is valid for 2 minutes. If you did not request this, please ignore this email.</p>
            </div>
          `.replace('${otp}', otp)
        });
        console.log('✅ [APPS SCRIPT] Email sent successfully');
      } catch (mailErr) {
        console.error('❌ [APPS SCRIPT] MailApp Error:', mailErr);
        throw new Error('Email sending failed: ' + mailErr.message);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        message: "OTP sent to admin email" 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 🔐 [NEW] Handle Admin OTP Verification
    if (action === 'verify_admin_otp') {
      const payload = JSON.parse(e.postData.contents);
      const userOtp = String(payload.otp).trim();
      console.log('🔍 [APPS SCRIPT] Verifying OTP:', userOtp);
      
      const props = PropertiesService.getScriptProperties();
      const savedOtp = props.getProperty('ADMIN_OTP');
      const savedTime = props.getProperty('ADMIN_OTP_TIME');
      
      const isExpired = !savedTime || (Date.now() - parseInt(savedTime)) > 120000; // 2 mins
      
      if (isExpired) {
        console.warn('⚠️ [APPS SCRIPT] OTP Expired');
        return ContentService.createTextOutput(JSON.stringify({ 
          success: false, 
          message: "OTP expired (2 mins validity). Please try again." 
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      if (userOtp === savedOtp) {
        console.log('✅ [APPS SCRIPT] OTP Verified successfully');
        props.deleteProperty('ADMIN_OTP');
        props.deleteProperty('ADMIN_OTP_TIME');
        return ContentService.createTextOutput(JSON.stringify({ 
          success: true, 
          message: "OTP Verified Successfully",
          redirectUrl: "https://docs.google.com/spreadsheets/d/1_dRoBB-cyu5xhzxBZvJPc59OOiHJiTACK6wIs_iNRLk/edit"
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        console.warn('❌ [APPS SCRIPT] Invalid OTP attempt');
        return ContentService.createTextOutput(JSON.stringify({ 
          success: false, 
          message: "Invalid OTP. Please check and try again." 
        })).setMimeType(ContentService.MimeType.JSON);
      }
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
    console.error('Apps Script Error:', err);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
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
