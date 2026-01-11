export interface YMLCategory {
  id: string;
  name: string;
  parentId?: string;
}

export interface YMLCurrency {
  code: string;
  rate: number;
}

export interface YMLOffer {
  id: string;
  available: boolean;
  url?: string;
  price: number;
  currencyId: string;
  categoryId: string;
  picture: string[];
  vendor: string;
  model?: string;
  name: string;
  description?: string;
  name_ua?: string;
  description_ua?: string;
  stock_quantity?: number;
  params: Array<{ name: string; value: string }>;
}

export interface YMLData {
  categories: YMLCategory[];
  currencies: YMLCurrency[];
  offers: YMLOffer[];
}

function getElementText(element: Element, tagName: string): string {
  const el = element.querySelector(tagName);
  return el?.textContent?.trim() || '';
}

export async function parseYMLFile(xmlContent: string): Promise<YMLData> {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid XML format: ' + parserError.textContent);
  }

  const shop = xmlDoc.querySelector('yml_catalog shop');
  if (!shop) {
    throw new Error('Invalid YML format: shop element not found');
  }

  const categories: YMLCategory[] = [];
  const categoryElements = shop.querySelectorAll('categories > category');
  categoryElements.forEach((cat) => {
    const id = cat.getAttribute('id');
    const parentId = cat.getAttribute('parentId');
    const name = cat.textContent?.trim() || '';
    if (id) {
      categories.push({
        id,
        name,
        parentId: parentId || undefined,
      });
    }
  });

  const currencies: YMLCurrency[] = [];
  const currencyElements = shop.querySelectorAll('currencies > currency');
  currencyElements.forEach((curr) => {
    const code = curr.getAttribute('id');
    const rateStr = curr.getAttribute('rate');
    if (code) {
      currencies.push({
        code,
        rate: rateStr ? parseFloat(rateStr) : 1.0,
      });
    }
  });

  const offers: YMLOffer[] = [];
  const offerElements = shop.querySelectorAll('offers > offer');
  offerElements.forEach((offer) => {
    const id = offer.getAttribute('id');
    const available = offer.getAttribute('available') === 'true';

    if (!id) return;

    const pictures: string[] = [];
    const pictureElements = offer.querySelectorAll('picture');
    pictureElements.forEach((pic) => {
      const url = pic.textContent?.trim();
      if (url) pictures.push(url);
    });

    const params: Array<{ name: string; value: string }> = [];
    const paramElements = offer.querySelectorAll('param');
    paramElements.forEach((param) => {
      const name = param.getAttribute('name');
      const value = param.textContent?.trim();
      if (name && value) {
        params.push({ name, value });
      }
    });

    const priceStr = getElementText(offer, 'price');
    const stockStr = getElementText(offer, 'stock_quantity');

    offers.push({
      id,
      available,
      url: getElementText(offer, 'url') || undefined,
      price: priceStr ? parseFloat(priceStr) : 0,
      currencyId: getElementText(offer, 'currencyId') || 'UAH',
      categoryId: getElementText(offer, 'categoryId'),
      picture: pictures,
      vendor: getElementText(offer, 'vendor') || '',
      model: getElementText(offer, 'model') || undefined,
      name: getElementText(offer, 'name'),
      description: getElementText(offer, 'description') || undefined,
      name_ua: getElementText(offer, 'name_ua') || undefined,
      description_ua: getElementText(offer, 'description_ua') || undefined,
      stock_quantity: stockStr ? parseInt(stockStr) : 0,
      params,
    });
  });

  return { categories, currencies, offers };
}
