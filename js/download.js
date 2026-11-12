/**
 * Saves text as a file on the visitor's device.
 * The file is made inside the browser, so nothing is uploaded; the security policy allows this.
 */

// Long enough for every browser to start the download before the temporary link is released.
const RELEASE_LINK_AFTER_MS = 1000;

export function saveTextAsFile(text, fileName) {
  const file = new Blob([text], { type: 'application/json' });
  const fileUrl = URL.createObjectURL(file);

  const link = document.createElement('a');
  link.href = fileUrl;
  link.download = fileName;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(fileUrl), RELEASE_LINK_AFTER_MS);
}
