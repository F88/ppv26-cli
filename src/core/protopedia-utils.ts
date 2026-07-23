const PROTOPEDIA_PROTOTYPE_BASE_URL = 'https://protopedia.net/prototype';
export const buildPrototypeLink = (prototypeId: number): string => {
  return `${PROTOPEDIA_PROTOTYPE_BASE_URL}/${prototypeId}`;
};
