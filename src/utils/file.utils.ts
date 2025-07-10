export const bufferToDataURI = (mimetype: string, buffer: Buffer): string => {
  const base64 = buffer.toString('base64');
  return `data:${mimetype};base64,${base64}`;
};
