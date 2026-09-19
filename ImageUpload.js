/* =========================
   IMAGE UPLOAD
========================= */

function uploadImageToDrive(base64Data, filename, sku) {
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

  const folder = getImageFolder_();
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();

  return {
    success: true,
    fileId: fileId,
    url: 'https://lh3.googleusercontent.com/d/' + fileId + '=w1000'
  };
}

function getImageFolder_() {
  const folders = DriveApp.getFoldersByName(IMAGE_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(IMAGE_FOLDER_NAME);
}
