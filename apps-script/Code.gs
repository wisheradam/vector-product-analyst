function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var expectedSecret = props.getProperty('VECTOR_WEBHOOK_SECRET');
    var suppliedSecret = e && e.parameter ? e.parameter.token : '';

    // Optional protection: if VECTOR_WEBHOOK_SECRET is configured,
    // the endpoint must be called with ?token=<secret>.
    if (expectedSecret && suppliedSecret !== expectedSecret) {
      return jsonResponse_({ success: false, error: 'unauthorized' });
    }

    var raw = e && e.postData ? e.postData.contents : '';
    var data = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (parseError) {
      data = { raw: raw };
    }

    var spreadsheet = getOrCreateSpreadsheet_();
    var headers = getHeaders_();
    var sheet = getOrCreateEventsSheet_(spreadsheet, headers);

    var payload = firstObject_(data.data, data.payload, data);
    var contact = firstObject_(payload.contact, data.contact, payload.visitor, payload);
    var company = firstObject_(contact.company, payload.company, data.company, {});
    var page = firstObject_(contact.page, payload.page, data.page, {});
    var intent = firstObject_(payload.intent, data.intent, {});

    var visitorActivities = Array.isArray(payload.visitorActivities)
      ? payload.visitorActivities
      : (Array.isArray(data.visitorActivities) ? data.visitorActivities : []);

    var eventType = firstValue_(
      data.type,
      data.event,
      data.eventType,
      payload.type,
      payload.eventType
    );

    var visitorId = firstValue_(
      contact.upId,
      payload.upId,
      data.upId,
      contact.vvid,
      contact.visitorId,
      payload.vvid,
      payload.visitorId,
      data.vvid,
      data.visitorId,
      contact.primaryId,
      payload.primaryId,
      data.primaryId
    );

    var row = [
      new Date(),
      eventType,
      visitorId,
      firstValue_(contact.primaryId, payload.primaryId, data.primaryId),
      firstValue_(contact.primaryIdType, payload.primaryIdType, data.primaryIdType),
      firstValue_(contact.firstName, contact.first_name),
      firstValue_(contact.lastName, contact.last_name),
      firstValue_(contact.email, payload.email, data.email),
      firstValue_(contact.businessEmail, payload.businessEmail, data.businessEmail),
      firstValue_(contact.personalEmail, payload.personalEmail, data.personalEmail),
      firstValue_(contact.title, contact.jobTitle, contact.job_title),
      firstValue_(contact.department, payload.department, data.department),
      firstValue_(contact.seniority, payload.seniority, data.seniority),
      firstValue_(company.name, contact.companyName, typeof contact.company === 'string' ? contact.company : '', payload.company, data.company),
      firstValue_(company.domain, contact.companyDomain, contact.company_domain, payload.companyDomain, data.companyDomain),
      firstValue_(contact.industry, payload.industry, data.industry, company.industry),
      firstValue_(contact.companySize, payload.companySize, data.companySize, company.size),
      firstValue_(contact.companyLinkedinUrl, payload.companyLinkedinUrl, data.companyLinkedinUrl),
      firstValue_(contact.linkedinUrl, contact.linkedin, contact.linkedin_url, payload.linkedinUrl, data.linkedinUrl),
      firstValue_(contact.country, payload.country, data.country),
      stringifyValue_(firstValue_(contact.location, payload.location, data.location)),
      firstValue_(page.title, contact.pageTitle, payload.pageTitle, data.pageTitle),
      firstValue_(page.url, contact.pageUrl, payload.pageUrl, data.pageUrl),
      firstValue_(page.referrer, contact.referrer, payload.referrer, data.referrer),
      firstValue_(contact.firstVisitAt, payload.firstVisitAt, data.firstVisitAt),
      firstValue_(contact.lastVisitAt, payload.lastVisitAt, data.lastVisitAt),
      firstValue_(contact.evaluatedAt, payload.evaluatedAt, data.evaluatedAt),
      firstValue_(contact.uniquePagesVisited, payload.uniquePagesVisited, data.uniquePagesVisited),
      firstValue_(contact.segmentId, payload.segmentId, data.segmentId),
      firstValue_(contact.segmentName, payload.segmentName, data.segmentName),
      firstValue_(contact.utmSource, payload.utmSource, data.utmSource),
      firstValue_(contact.utmMedium, payload.utmMedium, data.utmMedium),
      firstValue_(contact.utmCampaign, payload.utmCampaign, data.utmCampaign),
      firstValue_(contact.utmContent, payload.utmContent, data.utmContent),
      firstValue_(contact.utmTerm, payload.utmTerm, data.utmTerm),
      firstValue_(intent.topic, intent.keyword, payload.intentTopic, data.intentTopic),
      firstValue_(intent.score, payload.intentScore, data.intentScore),
      visitorActivities.length,
      raw
    ];

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      sheet.appendRow(row);
    } finally {
      lock.releaseLock();
    }

    return jsonResponse_({ success: true, received: true, sheet: sheet.getName() });
  } catch (error) {
    return jsonResponse_({ success: false, error: String(error) });
  }
}

function doGet() {
  return jsonResponse_({
    status: 'ok',
    service: 'Vector Website Analytics Collector'
  });
}

function getHeaders_() {
  return [
    'Received At',
    'Event Type',
    'Visitor ID',
    'Primary ID',
    'Primary ID Type',
    'First Name',
    'Last Name',
    'Email',
    'Business Email',
    'Personal Email',
    'Job Title',
    'Department',
    'Seniority',
    'Company',
    'Company Domain',
    'Industry',
    'Company Size',
    'Company LinkedIn',
    'LinkedIn',
    'Country',
    'Location',
    'Page Title',
    'Page URL',
    'Referrer',
    'First Visit At',
    'Last Visit At',
    'Evaluated At',
    'Unique Pages Visited',
    'Segment ID',
    'Segment Name',
    'UTM Source',
    'UTM Medium',
    'UTM Campaign',
    'UTM Content',
    'UTM Term',
    'Intent Topic',
    'Intent Score',
    'Visitor Activity Count',
    'Raw JSON'
  ];
}

function getOrCreateSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = props.getProperty('VECTOR_SHEET_ID');

  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  var spreadsheet = SpreadsheetApp.create('Vector Website Analytics Data');
  props.setProperty('VECTOR_SHEET_ID', spreadsheet.getId());
  return spreadsheet;
}

function getOrCreateEventsSheet_(spreadsheet, headers) {
  var props = PropertiesService.getScriptProperties();
  var configuredName = props.getProperty('VECTOR_EVENTS_SHEET');

  if (configuredName) {
    var configured = spreadsheet.getSheetByName(configuredName);
    if (configured && headersMatch_(configured, headers)) return configured;
  }

  var sheets = spreadsheet.getSheets();
  var maxVersion = 0;

  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var name = sheet.getName();
    var match = name.match(/^Events(?: v(\d+))?$/);
    if (!match) continue;

    var version = match[1] ? Number(match[1]) : 1;
    if (version > maxVersion) maxVersion = version;

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      props.setProperty('VECTOR_EVENTS_SHEET', name);
      return sheet;
    }

    if (headersMatch_(sheet, headers)) {
      props.setProperty('VECTOR_EVENTS_SHEET', name);
      return sheet;
    }
  }

  var newName = maxVersion === 0 ? 'Events' : 'Events v' + (maxVersion + 1);
  var newSheet = spreadsheet.insertSheet(newName);
  newSheet.appendRow(headers);
  props.setProperty('VECTOR_EVENTS_SHEET', newName);
  return newSheet;
}

function headersMatch_(sheet, headers) {
  if (!sheet || sheet.getLastColumn() < headers.length || sheet.getLastRow() < 1) return false;
  var existing = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (existing[i] !== headers[i]) return false;
  }
  return true;
}

function firstObject_() {
  for (var i = 0; i < arguments.length; i++) {
    var value = arguments[i];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value;
    }
  }
  return {};
}

function firstValue_() {
  for (var i = 0; i < arguments.length; i++) {
    var value = arguments[i];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return '';
}

function stringifyValue_(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function jsonResponse_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
