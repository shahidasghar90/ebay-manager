/* =========================
   HELPERS
========================= */

function getSheet_(name) {
  const sheet = getSpreadsheet_().getSheetByName(name);

  if (!sheet) {
    throw new Error(`Sheet not found: ${name}`);
  }

  return sheet;
}

function safeGetSheetObjects_(name) {
  try {
    return getSheetObjects_(name);
  } catch (error) {
    return [];
  }
}

function getSheetObjects_(name) {
  const sheet = getSheet_(name);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) return [];

  const headers = values[0].map(header => String(header).trim());

  return values
    .slice(1)
    .filter(row => row.some(cell => cell !== ''))
    .map(row => {
      const result = {};

      headers.forEach((header, index) => {
        result[header] = sanitizeCellValue_(row[index]);
      });

      return result;
    });
}

function sanitizeCellValue_(value) {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? '' : value.toISOString();
  }

  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return String(value);
  }

  return value;
}

function findRowIndexByColumnValue_(sheet, columnIndex, value) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return null;

  const values = sheet
    .getRange(2, columnIndex, lastRow - 1, 1)
    .getValues()
    .flat();

  const offset = values.findIndex(cell => String(cell) === String(value));

  return offset === -1 ? null : offset + 2;
}

function nextPrefixedId_(sheet, prefix, startNumber) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return prefix + (startNumber + 1);
  }

  const ids = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .flat();

  let largest = startNumber;

  ids.forEach(id => {
    const text = String(id || '');

    if (text.startsWith(prefix)) {
      const number = parseInt(text.replace(prefix, ''), 10);

      if (!isNaN(number) && number > largest) {
        largest = number;
      }
    }
  });

  return prefix + (largest + 1);
}

function nextNumericId_(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return 1;

  const values = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .flat();

  let largest = 0;

  values.forEach(value => {
    const number = parseInt(value, 10);

    if (!isNaN(number) && number > largest) {
      largest = number;
    }
  });

  return largest + 1;
}

function toNumber_(value, defaultValue) {
  const number = Number(value);

  if (isNaN(number)) {
    return defaultValue !== undefined ? defaultValue : 0;
  }

  return number;
}

function formatDate_(value) {
  if (!value) return '';

  const date = new Date(value);

  if (isNaN(date.getTime())) return '';

  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );
}

function validateRequired_(data, fields) {
  const missing = fields.filter(field => {
    return data[field] === undefined ||
      data[field] === null ||
      data[field] === '';
  });

  if (missing.length) {
    throw new Error(
      'Required fields missing: ' + missing.join(', ')
    );
  }
}

function normalizeUrl_(value) {
  const trimmed = String(value || '').trim();

  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  return 'https://' + trimmed;
}
