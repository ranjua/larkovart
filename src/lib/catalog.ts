import type { Locale } from "./i18n.ts";
export type Category = "paintings" | "drawings" | "sculptures";
export type Artwork = {
  id: string;
  title: string;
  category: Category;
  image: string;
  medium: "oil" | "acrylic" | "mixed" | "charcoal" | "bronze" | "other";
  width: number;
  height: number;
  year: number;
  price: number;
  status: "available" | "reserved" | "sold";
  parcel?: import("./integrations/dhl.ts").Parcel;
  published: boolean;
  descriptions: Record<Locale, string>;
};
// Prices are illustrative DEVELOPMENT data. Original sold states and artwork
// metadata come from the archived catalog; verify all details before launch.
export const seedArtworks: Artwork[] = [
  {
    id: "atitlan",
    title: "Atitlan",
    category: "paintings",
    image: "/artworks/Atitlan.jpg",
    medium: "oil",
    width: 50,
    height: 50,
    year: 2024,
    price: 42500,
    status: "available",
    published: true,
    descriptions: {
      en: "A landscape painting of Lake Atitlán, Guatemala. Oil on canvas.",
      es: "Un paisaje del lago de Atitlán, Guatemala. Óleo sobre lienzo.",
      ru: "Пейзаж озера Атитлан в Гватемале. Холст, масло.",
      zh: "危地马拉阿蒂特兰湖风景画，布面油画。",
      ja: "グアテマラのアティトラン湖を描いた風景画。キャンバスに油彩。",
      pt: "Uma paisagem do lago Atitlán, na Guatemala. Óleo sobre tela.",
    },
  },
  {
    id: "gato",
    title: "Gato",
    category: "paintings",
    image: "/artworks/Gato.jpg",
    medium: "acrylic",
    width: 50,
    height: 50,
    year: 2024,
    price: 27500,
    status: "available",
    published: true,
    descriptions: {
      en: "A portrait study of a cat. Acrylic on canvas.",
      es: "Un estudio del retrato de un gato. Acrílico sobre lienzo.",
      ru: "Портретный этюд кота. Акрил на холсте.",
      zh: "猫的肖像习作，布面丙烯。",
      ja: "猫のポートレート習作。キャンバスにアクリル。",
      pt: "Um estudo de retrato de um gato. Acrílico sobre tela.",
    },
  },
  {
    id: "mar",
    title: "Mar2",
    category: "paintings",
    image: "/artworks/Mar2.jpg",
    medium: "oil",
    width: 50,
    height: 50,
    year: 2025,
    price: 35000,
    status: "available",
    published: true,
    descriptions: {
      en: "An original seascape. Oil on canvas.",
      es: "Un paisaje marino original. Óleo sobre lienzo.",
      ru: "Авторский морской пейзаж. Холст, масло.",
      zh: "原创海景画，布面油画。",
      ja: "オリジナルの海景画。キャンバスに油彩。",
      pt: "Uma paisagem marinha original. Óleo sobre tela.",
    },
  },
  {
    id: "peonea",
    title: "Peonea",
    category: "paintings",
    image: "/artworks/Peonea.jpg",
    medium: "oil",
    width: 50,
    height: 50,
    year: 2024,
    price: 40000,
    status: "sold",
    published: true,
    descriptions: {
      en: "A peony still life. Oil on canvas. In a private collection.",
      es: "Una naturaleza muerta de peonía. Óleo sobre lienzo. En colección privada.",
      ru: "Натюрморт с пионом. Холст, масло. В частной коллекции.",
      zh: "牡丹静物画，布面油画，已被私人收藏。",
      ja: "牡丹の静物画。キャンバスに油彩。個人コレクション所蔵。",
      pt: "Uma natureza-morta de peônia. Óleo sobre tela. Em coleção particular.",
    },
  },
  {
    id: "quetzal",
    title: "Quetzal",
    category: "paintings",
    image: "/artworks/Quetzal.jpg",
    medium: "mixed",
    width: 50,
    height: 50,
    year: 2024,
    price: 50000,
    status: "sold",
    published: true,
    descriptions: {
      en: "A painting of the quetzal bird. Mixed media on canvas. In a private collection.",
      es: "Una pintura del ave quetzal. Técnica mixta sobre lienzo. En colección privada.",
      ru: "Картина с птицей кетцаль. Смешанная техника на холсте. В частной коллекции.",
      zh: "格查尔鸟绘画，布面综合材料，已被私人收藏。",
      ja: "ケツァールを描いた作品。キャンバスにミクストメディア。個人コレクション所蔵。",
      pt: "Uma pintura da ave quetzal. Técnica mista sobre tela. Em coleção particular.",
    },
  },
];
const media: Record<Locale, Record<Artwork["medium"], string>> = {
  en: {
    oil: "Oil on canvas",
    acrylic: "Acrylic on canvas",
    mixed: "Mixed media on canvas",
    charcoal: "Charcoal on paper",
    bronze: "Bronze",
    other: "Other materials",
  },
  es: {
    oil: "Óleo sobre lienzo",
    acrylic: "Acrílico sobre lienzo",
    mixed: "Técnica mixta sobre lienzo",
    charcoal: "Carboncillo sobre papel",
    bronze: "Bronce",
    other: "Otros materiales",
  },
  ru: {
    oil: "Холст, масло",
    acrylic: "Акрил на холсте",
    mixed: "Смешанная техника на холсте",
    charcoal: "Уголь на бумаге",
    bronze: "Бронза",
    other: "Другие материалы",
  },
  zh: {
    oil: "布面油画",
    acrylic: "布面丙烯",
    mixed: "布面综合材料",
    charcoal: "纸上炭笔",
    bronze: "青铜",
    other: "其他材料",
  },
  ja: {
    oil: "キャンバスに油彩",
    acrylic: "キャンバスにアクリル",
    mixed: "キャンバスにミクストメディア",
    charcoal: "紙に木炭",
    bronze: "ブロンズ",
    other: "その他の素材",
  },
  pt: {
    oil: "Óleo sobre tela",
    acrylic: "Acrílico sobre tela",
    mixed: "Técnica mista sobre tela",
    charcoal: "Carvão sobre papel",
    bronze: "Bronze",
    other: "Outros materiais",
  },
};
export function mediumName(a: Artwork, locale: Locale) {
  return media[locale][a.medium];
}
