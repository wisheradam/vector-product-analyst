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
    var sheet = spreadsheet.getSheetByName('Events');

    var headers = [
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
      'Company',
      'Company Domain',
      'Company LinkedIn',
      'LinkedIn',
      'Country',
      'Location',
      'Page Title',
      'Page URL',
      'Referrer',
      'First Visit At',
      'Last Visit At',
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

    if (!sheet) {
      sheet = spreadsheet.insertSheet('Events');
      sheet.appendRow(headers);
    } else if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
    } else {
      ensureHeaders_(sheet, headers);
    }

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
      firstValue_(company.name, contact.companyName, typeof contact.company === 'string' ? contact.company : '', payload.company, data.company),
      firstValue_(company.domain, contact.companyDomain, contact.company_domain, payload.companyDomain, data.companyDomain),
      firstValue_(contact.companyLinkedinUrl, payload.companyLinkedinUrl, data.companyLinkedinUrl),
      firstValue_(contact.linkedinUrl, contact.linkedin, contact.linkedin_url, payload.linkedinUrl, data.linkedinUrl),
      firstValue_(contact.country, payload.country, data.country),
      stringifyValue_(firstValue_(contact.location, payload.location, data.location)),
      firstValue_(page.title, contact.pageTitle, payload.pageTitle, data.pageTitle),
      firstValue_(page.url, contact.pageUrl, payload.pageUrl, data.pageUrl),
      firstValue_(page.referrer, contact.referrer, payload.referrer, data.referrer),
      firstValue_(contact.firstVisitAt, payload.firstVisitAt, data.firstVisitAt),
      firstValue_(contact.lastVisitAt, payload.lastVisitAt, data.lastVisitAt),
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

    return jsonResponse_({ success: true, received: true });
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

function ensureHeaders_(sheet, headers) {
  var existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  var needsUpdate = false;

  for (var i = 0; i < headers.length; i++) {
    if (existing[i] !== headers[i]) {
      needsUpdate = true;
      break;
    }
  }

  if (needsUpdate) {
    // Preserve old data by creating a new schema sheet instead of shifting columns.
    var spreadsheet = sheet.getParent();
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Etc/UTC', 'yyyyMMdd-HHmmss');
    var newSheet = spreadsheet.insertSheet('Events-v2-' + timestamp);
    newSheet.appendRow(headers);
    PropertiesService.getScriptProperties().setProperty('VECTOR_EVENTS_SHEET', newSheet.getName());
  }
}

function getEventsSheet_(spreadsheet) {
  var props = PropertiesService.getScriptProperties();
  var configuredName = props.getProperty('VECTOR_EVENTS_SHEET');
  if (configuredName) {
    var configured = spreadsheet.getSheetByName(configuredName);
    if (configured) return configured;
  }
  return spreadsheet.getSheetByName('Events');
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
