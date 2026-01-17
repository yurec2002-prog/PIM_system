import { create } from 'zustand';

export type AttributeType = 'string' | 'number' | 'boolean' | 'enum';
export type AttributeSource = 'sandi' | 'manual' | 'supplier';
export type InboxStatus = 'new' | 'linked' | 'created' | 'ignored';

export interface DictionaryAttribute {
  id: string;
  key: string;
  code: string;
  labels: {
    ru: string;
    ro?: string;
    en?: string;
  };
  type: AttributeType;
  source: AttributeSource;
  unit?: string;
  needs_review: boolean;
  usage_categories: number;
  usage_products: number;
  created_at: string;
  updated_at: string;
}

export interface InboxItem {
  id: string;
  raw_name: string;
  supplier_id?: string;
  supplier_name?: string;
  seen_count: number;
  status: InboxStatus;
  last_seen: string;
  suggested_match_id?: string;
  linked_attribute_id?: string;
  created_at: string;
}

interface AttributeStoreState {
  dictionary: DictionaryAttribute[];
  inbox: InboxItem[];

  getDictionaryAttribute: (id: string) => DictionaryAttribute | undefined;
  searchDictionary: (query: string) => DictionaryAttribute[];
  updateDictionaryAttribute: (id: string, updates: Partial<DictionaryAttribute>) => void;
  createDictionaryAttribute: (attribute: Omit<DictionaryAttribute, 'id' | 'created_at' | 'updated_at'>) => DictionaryAttribute;

  getInboxItem: (id: string) => InboxItem | undefined;
  getInboxByStatus: (status: InboxStatus | 'all') => InboxItem[];
  linkInboxToAttribute: (inboxId: string, attributeId: string) => void;
  createAttributeFromInbox: (inboxId: string, attribute: Omit<DictionaryAttribute, 'id' | 'created_at' | 'updated_at' | 'usage_categories' | 'usage_products'>) => void;
  ignoreInboxItem: (inboxId: string) => void;
  addToInbox: (item: Omit<InboxItem, 'id' | 'created_at' | 'status'>) => void;
}

const mockDictionary: DictionaryAttribute[] = [
  {
    id: 'attr-1',
    key: 'sandi:weight',
    code: 'weight',
    labels: { ru: 'Вес', ro: 'Greutate', en: 'Weight' },
    type: 'number',
    source: 'sandi',
    unit: 'kg',
    needs_review: false,
    usage_categories: 15,
    usage_products: 234,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'attr-2',
    key: 'sandi:length',
    code: 'length',
    labels: { ru: 'Длина', ro: 'Lungime', en: 'Length' },
    type: 'number',
    source: 'sandi',
    unit: 'mm',
    needs_review: false,
    usage_categories: 12,
    usage_products: 189,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'attr-3',
    key: 'sandi:width',
    code: 'width',
    labels: { ru: 'Ширина', ro: 'Lățime', en: 'Width' },
    type: 'number',
    source: 'sandi',
    unit: 'mm',
    needs_review: false,
    usage_categories: 12,
    usage_products: 189,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'attr-4',
    key: 'sandi:height',
    code: 'height',
    labels: { ru: 'Высота', ro: 'Înălțime', en: 'Height' },
    type: 'number',
    source: 'sandi',
    unit: 'mm',
    needs_review: false,
    usage_categories: 12,
    usage_products: 189,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'attr-5',
    key: 'sandi:brand',
    code: 'brand',
    labels: { ru: 'Бренд', ro: 'Brand', en: 'Brand' },
    type: 'string',
    source: 'sandi',
    needs_review: false,
    usage_categories: 28,
    usage_products: 456,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'attr-6',
    key: 'sandi:power',
    code: 'power',
    labels: { ru: 'Мощность', ro: 'Putere', en: 'Power' },
    type: 'number',
    source: 'sandi',
    unit: 'W',
    needs_review: false,
    usage_categories: 8,
    usage_products: 145,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'attr-7',
    key: 'boiler:inverter',
    code: 'inverter',
    labels: { ru: 'Инверторный', ro: 'Invertor', en: 'Inverter' },
    type: 'boolean',
    source: 'manual',
    needs_review: false,
    usage_categories: 2,
    usage_products: 34,
    created_at: '2024-01-16T10:00:00Z',
    updated_at: '2024-01-16T10:00:00Z',
  },
  {
    id: 'attr-8',
    key: 'boiler:contours_count',
    code: 'contours_count',
    labels: { ru: 'Количество контуров', ro: 'Număr de circuite', en: 'Contours count' },
    type: 'number',
    source: 'manual',
    needs_review: false,
    usage_categories: 2,
    usage_products: 45,
    created_at: '2024-01-16T10:00:00Z',
    updated_at: '2024-01-16T10:00:00Z',
  },
  {
    id: 'attr-9',
    key: 'sandi:color',
    code: 'color',
    labels: { ru: 'Цвет', ro: 'Culoare', en: 'Color' },
    type: 'string',
    source: 'sandi',
    needs_review: false,
    usage_categories: 18,
    usage_products: 267,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'attr-10',
    key: 'sandi:material',
    code: 'material',
    labels: { ru: 'Материал', ro: 'Material', en: 'Material' },
    type: 'string',
    source: 'sandi',
    needs_review: false,
    usage_categories: 14,
    usage_products: 198,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'attr-11',
    key: 'sandi:voltage',
    code: 'voltage',
    labels: { ru: 'Напряжение', ro: 'Tensiune', en: 'Voltage' },
    type: 'number',
    source: 'sandi',
    unit: 'V',
    needs_review: false,
    usage_categories: 6,
    usage_products: 98,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'attr-12',
    key: 'hvac:energy_class',
    code: 'energy_class',
    labels: { ru: 'Класс энергопотребления', ro: 'Clasa energetică', en: 'Energy class' },
    type: 'enum',
    source: 'manual',
    needs_review: false,
    usage_categories: 4,
    usage_products: 67,
    created_at: '2024-01-17T10:00:00Z',
    updated_at: '2024-01-17T10:00:00Z',
  },
  {
    id: 'attr-13',
    key: 'sandi:warranty',
    code: 'warranty',
    labels: { ru: 'Гарантия', ro: 'Garanție', en: 'Warranty' },
    type: 'number',
    source: 'sandi',
    unit: 'months',
    needs_review: false,
    usage_categories: 22,
    usage_products: 389,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'attr-14',
    key: 'supplier:connection_size',
    code: 'connection_size',
    labels: { ru: 'Размер подключения', ro: 'Dimensiune conexiune', en: 'Connection size' },
    type: 'string',
    source: 'supplier',
    needs_review: true,
    usage_categories: 3,
    usage_products: 28,
    created_at: '2024-01-18T10:00:00Z',
    updated_at: '2024-01-18T10:00:00Z',
  },
  {
    id: 'attr-15',
    key: 'sandi:capacity',
    code: 'capacity',
    labels: { ru: 'Объем', ro: 'Capacitate', en: 'Capacity' },
    type: 'number',
    source: 'sandi',
    unit: 'L',
    needs_review: false,
    usage_categories: 7,
    usage_products: 112,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'attr-16',
    key: 'sandi:pressure',
    code: 'pressure',
    labels: { ru: 'Давление', ro: 'Presiune', en: 'Pressure' },
    type: 'number',
    source: 'sandi',
    unit: 'bar',
    needs_review: false,
    usage_categories: 5,
    usage_products: 78,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'attr-17',
    key: 'hvac:noise_level',
    code: 'noise_level',
    labels: { ru: 'Уровень шума', ro: 'Nivel zgomot', en: 'Noise level' },
    type: 'number',
    source: 'manual',
    unit: 'dB',
    needs_review: false,
    usage_categories: 3,
    usage_products: 45,
    created_at: '2024-01-17T10:00:00Z',
    updated_at: '2024-01-17T10:00:00Z',
  },
  {
    id: 'attr-18',
    key: 'supplier:heating_type',
    code: 'heating_type',
    labels: { ru: 'Тип нагрева', ro: 'Tip încălzire', en: 'Heating type' },
    type: 'enum',
    source: 'supplier',
    needs_review: true,
    usage_categories: 2,
    usage_products: 23,
    created_at: '2024-01-18T10:00:00Z',
    updated_at: '2024-01-18T10:00:00Z',
  },
];

const mockInbox: InboxItem[] = [
  {
    id: 'inbox-1',
    raw_name: 'Масса (кг)',
    supplier_name: 'Sandi',
    seen_count: 47,
    status: 'new',
    last_seen: '2024-01-18T15:30:00Z',
    suggested_match_id: 'attr-1',
    created_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'inbox-2',
    raw_name: 'Размер подключений',
    supplier_name: 'Sandi',
    seen_count: 23,
    status: 'new',
    last_seen: '2024-01-18T14:20:00Z',
    suggested_match_id: 'attr-14',
    created_at: '2024-01-16T10:00:00Z',
  },
  {
    id: 'inbox-3',
    raw_name: 'Одноконтурный / Двухконтурный',
    supplier_name: 'Termomax',
    seen_count: 18,
    status: 'new',
    last_seen: '2024-01-18T13:10:00Z',
    suggested_match_id: 'attr-8',
    created_at: '2024-01-16T10:00:00Z',
  },
  {
    id: 'inbox-4',
    raw_name: 'Инверторность',
    supplier_name: 'Termomax',
    seen_count: 15,
    status: 'new',
    last_seen: '2024-01-18T12:00:00Z',
    suggested_match_id: 'attr-7',
    created_at: '2024-01-16T10:00:00Z',
  },
  {
    id: 'inbox-5',
    raw_name: 'Рабочая температура',
    supplier_name: 'Sandi',
    seen_count: 32,
    status: 'new',
    last_seen: '2024-01-18T11:45:00Z',
    created_at: '2024-01-17T10:00:00Z',
  },
  {
    id: 'inbox-6',
    raw_name: 'Тип монтажа',
    supplier_name: 'Termomax',
    seen_count: 28,
    status: 'new',
    last_seen: '2024-01-18T10:30:00Z',
    created_at: '2024-01-17T10:00:00Z',
  },
  {
    id: 'inbox-7',
    raw_name: 'Площадь обогрева',
    supplier_name: 'Sandi',
    seen_count: 19,
    status: 'new',
    last_seen: '2024-01-18T09:15:00Z',
    created_at: '2024-01-17T10:00:00Z',
  },
  {
    id: 'inbox-8',
    raw_name: 'КПД',
    supplier_name: 'Termomax',
    seen_count: 14,
    status: 'new',
    last_seen: '2024-01-18T08:00:00Z',
    created_at: '2024-01-17T10:00:00Z',
  },
  {
    id: 'inbox-9',
    raw_name: 'Максимальное давление',
    supplier_name: 'Sandi',
    seen_count: 26,
    status: 'new',
    last_seen: '2024-01-18T07:45:00Z',
    suggested_match_id: 'attr-16',
    created_at: '2024-01-17T10:00:00Z',
  },
  {
    id: 'inbox-10',
    raw_name: 'Диаметр подключения',
    supplier_name: 'Termomax',
    seen_count: 21,
    status: 'new',
    last_seen: '2024-01-18T06:30:00Z',
    suggested_match_id: 'attr-14',
    created_at: '2024-01-17T10:00:00Z',
  },
  {
    id: 'inbox-11',
    raw_name: 'Производительность',
    supplier_name: 'Sandi',
    seen_count: 17,
    status: 'new',
    last_seen: '2024-01-17T15:00:00Z',
    created_at: '2024-01-17T10:00:00Z',
  },
  {
    id: 'inbox-12',
    raw_name: 'Тип камеры сгорания',
    supplier_name: 'Termomax',
    seen_count: 12,
    status: 'new',
    last_seen: '2024-01-17T14:00:00Z',
    created_at: '2024-01-17T10:00:00Z',
  },
  {
    id: 'inbox-13',
    raw_name: 'Расход газа',
    supplier_name: 'Sandi',
    seen_count: 24,
    status: 'new',
    last_seen: '2024-01-17T13:00:00Z',
    created_at: '2024-01-17T10:00:00Z',
  },
];

export const useAttributeStore = create<AttributeStoreState>((set, get) => ({
  dictionary: mockDictionary,
  inbox: mockInbox,

  getDictionaryAttribute: (id: string) => {
    return get().dictionary.find(attr => attr.id === id);
  },

  searchDictionary: (query: string) => {
    const lowerQuery = query.toLowerCase();
    return get().dictionary.filter(attr =>
      attr.labels.ru.toLowerCase().includes(lowerQuery) ||
      attr.labels.ro?.toLowerCase().includes(lowerQuery) ||
      attr.labels.en?.toLowerCase().includes(lowerQuery) ||
      attr.code.toLowerCase().includes(lowerQuery) ||
      attr.key.toLowerCase().includes(lowerQuery)
    );
  },

  updateDictionaryAttribute: (id: string, updates: Partial<DictionaryAttribute>) => {
    set(state => ({
      dictionary: state.dictionary.map(attr =>
        attr.id === id
          ? { ...attr, ...updates, updated_at: new Date().toISOString() }
          : attr
      ),
    }));
  },

  createDictionaryAttribute: (attribute: Omit<DictionaryAttribute, 'id' | 'created_at' | 'updated_at'>) => {
    const newAttr: DictionaryAttribute = {
      ...attribute,
      id: `attr-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    set(state => ({
      dictionary: [...state.dictionary, newAttr],
    }));

    return newAttr;
  },

  getInboxItem: (id: string) => {
    return get().inbox.find(item => item.id === id);
  },

  getInboxByStatus: (status: InboxStatus | 'all') => {
    if (status === 'all') return get().inbox;
    return get().inbox.filter(item => item.status === status);
  },

  linkInboxToAttribute: (inboxId: string, attributeId: string) => {
    set(state => ({
      inbox: state.inbox.map(item =>
        item.id === inboxId
          ? { ...item, status: 'linked' as InboxStatus, linked_attribute_id: attributeId }
          : item
      ),
    }));
  },

  createAttributeFromInbox: (inboxId: string, attribute: Omit<DictionaryAttribute, 'id' | 'created_at' | 'updated_at' | 'usage_categories' | 'usage_products'>) => {
    const newAttr = get().createDictionaryAttribute({
      ...attribute,
      usage_categories: 0,
      usage_products: 0,
    });

    set(state => ({
      inbox: state.inbox.map(item =>
        item.id === inboxId
          ? { ...item, status: 'created' as InboxStatus, linked_attribute_id: newAttr.id }
          : item
      ),
    }));
  },

  ignoreInboxItem: (inboxId: string) => {
    set(state => ({
      inbox: state.inbox.map(item =>
        item.id === inboxId
          ? { ...item, status: 'ignored' as InboxStatus }
          : item
      ),
    }));
  },

  addToInbox: (item: Omit<InboxItem, 'id' | 'created_at' | 'status'>) => {
    const newItem: InboxItem = {
      ...item,
      id: `inbox-${Date.now()}`,
      status: 'new',
      created_at: new Date().toISOString(),
    };

    set(state => ({
      inbox: [...state.inbox, newItem],
    }));
  },
}));
