/* =========================
   IMAGE UPLOAD
========================= */

const MAX_PRODUCT_IMAGES = 5;

function uploadImageToDrive(base64Data, filename, sku, condition, category) {
  if (!base64Data) {
    throw new Error('No image data provided.');
  }

  const commaIndex = base64Data.indexOf(',');
  const meta = commaIndex > -1 ? base64Data.substring(0, commaIndex) : '';
  const data = commaIndex > -1 ? base64Data.substring(commaIndex + 1) : base64Data;
  const mimeMatch = meta.match(/data:(.*);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  const bytes = Utilities.base64Decode(data);
  const blob = Utilities.newBlob(
    bytes,
    mimeType,
    (sku || 'product') + '_' + (filename || 'image.jpg')
  );

  const folder = getImageFolder_(condition, category);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();

  return {
    success: true,
    fileId: fileId,
    url: 'https://lh3.googleusercontent.com/d/' + fileId + '=w1000'
  };
}

function getImageFolder_(condition, category) {
  const root = getOrCreateChildFolder_(DriveApp.getRootFolder(), IMAGE_FOLDER_NAME);
  const conditionFolder = getOrCreateChildFolder_(root, sanitizeFolderName_(condition));
  return getOrCreateChildFolder_(conditionFolder, sanitizeFolderName_(category));
}

function getOrCreateChildFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function sanitizeFolderName_(name) {
  const cleaned = String(name || '').trim().replace(/[\\/:*?"<>|]/g, '-');
  return cleaned || 'Uncategorized';
}
