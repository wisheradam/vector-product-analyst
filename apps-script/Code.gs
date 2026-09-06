function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var expectedSecret = props.getProperty('VECTOR_WEBHOOK_SECRET');
    var suppliedSecret = e && e.parameter ? e.parameter.token : '';

    if (!expectedSecret) {
      return jsonResponse_({ success: false, error: 'VECTOR_WEBHOOK_SECRET is not configured' });
    }

    if (suppliedSecret !== expectedSecret) {
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

    if (!sheet) {
      sheet = spreadsheet.insertSheet('Events');
      sheet.appendRow([
        'Received At',
        'Event Type',
        'Event ID',
        'Visitor ID',
        'First Name',
        'Last Name',
        'Email',
        'Job Title',
        'Company',
        'Company Domain',
        'LinkedIn',
        'Location',
        'Page Title',
        'Page URL',
        'Referrer',
        'Last Visit At',
        'Intent Topic',
        'Intent Score',
        'Raw JSON'
      ]);
    }

    var payload = firstObject_(data.data, data.payload, data);
    var contact = firstObject_(payload.contact, data.contact, payload.visitor, payload);
    var company = firstObject_(contact.company, payload.company, data.company, {});
    var page = firstObject_(contact.page, payload.page, data.page, {});
    var intent = firstObject_(payload.intent, data.intent, {});

    var eventType = firstValue_(
      data.type,
      data.event,
      data.eventType,
      payload.type,
      payload.eventType
    );

    var eventId = firstValue_(data.id, data.eventId, payload.id, payload.eventId);
    var visitorId = firstValue_(
      contact.vvid,
      contact.visitorId,
      payload.vvid,
      payload.visitorId,
      data.vvid,
      data.visitorId
    );

    var row = [
      new Date(),
      eventType,
      eventId,
      visitorId,
      firstValue_(contact.firstName, contact.first_name),
      firstValue_(contact.lastName, contact.last_name),
      firstValue_(contact.email),
      firstValue_(contact.title, contact.jobTitle, contact.job_title),
      firstValue_(company.name, contact.companyName, typeof contact.company === 'string' ? contact.company : ''),
      firstValue_(company.domain, contact.companyDomain, contact.company_domain),
      firstValue_(contact.linkedinUrl, contact.linkedin, contact.linkedin_url),
      stringifyValue_(firstValue_(contact.location, payload.location, data.location)),
      firstValue_(page.title, contact.pageTitle, payload.pageTitle, data.pageTitle),
      firstValue_(page.url, contact.pageUrl, payload.pageUrl, data.pageUrl),
      firstValue_(page.referrer, contact.referrer, payload.referrer, data.referrer),
      firstValue_(contact.lastVisitAt, payload.lastVisitAt, data.lastVisitAt),
      firstValue_(intent.topic, intent.keyword, payload.intentTopic, data.intentTopic),
      firstValue_(intent.score, payload.intentScore, data.intentScore),
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
