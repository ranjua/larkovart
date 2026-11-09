import type { Locale } from "./i18n.ts";
// New interface labels only. Existing artist copy stays in the main dictionaries.
export const galleryCopy: Record<
  Locale,
  {
    skip: string;
    archive: string;
    contact: string;
    studioPhoto: string;
    close: string;
    expand: string;
    openMenu: string;
    closeMenu: string;
    loadingRoom: string;
    roomError: string;
    roomContext: string;
  }
> = {
  en: {
    roomError:
      "Room preview unavailable. The original photograph is still available.",
    skip: "Skip to the artwork",
    archive: "The collection archive",
    contact: "Contact the studio",
    studioPhoto: "Artwork in Yulia Larkova’s studio",
    close: "Close image",
    expand: "Explore the original photograph",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    loadingRoom: "Preparing the room preview…",
    roomContext: "A different perspective",
  },
  es: {
    roomError:
      "La vista de la sala no está disponible. Puedes ver la fotografía original.",
    skip: "Ir a las obras",
    archive: "El archivo de la colección",
    contact: "Contacta con el estudio",
    studioPhoto: "Una obra en el estudio de Yulia Larkova",
    close: "Cerrar imagen",
    expand: "Explora la fotografía original",
    openMenu: "Abrir menú",
    closeMenu: "Cerrar menú",
    loadingRoom: "Preparando la vista de la sala…",
    roomContext: "Otra perspectiva",
  },
  ru: {
    roomError:
      "Просмотр интерьера недоступен. Оригинальная фотография доступна.",
    skip: "Перейти к произведениям",
    archive: "Архив коллекции",
    contact: "Связаться со студией",
    studioPhoto: "Картина в студии Юлии Ларковой",
    close: "Закрыть изображение",
    expand: "Рассмотреть оригинальную фотографию",
    openMenu: "Открыть меню",
    closeMenu: "Закрыть меню",
    loadingRoom: "Подготовка интерьера…",
    roomContext: "Другой взгляд",
  },
  zh: {
    roomError: "室内预览暂不可用。仍可查看原始照片。",
    skip: "跳至作品",
    archive: "作品档案",
    contact: "联系工作室",
    studioPhoto: "尤莉娅·拉尔科娃工作室中的作品",
    close: "关闭图片",
    expand: "查看原始照片",
    openMenu: "打开菜单",
    closeMenu: "关闭菜单",
    loadingRoom: "正在准备室内预览…",
    roomContext: "另一种视角",
  },
  ja: {
    roomError:
      "室内プレビューを表示できません。オリジナル写真をご覧いただけます。",
    skip: "作品へスキップ",
    archive: "コレクションのアーカイブ",
    contact: "スタジオに問い合わせる",
    studioPhoto: "ユリア・ラルコワのスタジオにある作品",
    close: "画像を閉じる",
    expand: "オリジナル写真を見る",
    openMenu: "メニューを開く",
    closeMenu: "メニューを閉じる",
    loadingRoom: "室内プレビューを準備中…",
    roomContext: "もうひとつの視点",
  },
  pt: {
    roomError:
      "A prévia do ambiente está indisponível. A fotografia original continua disponível.",
    skip: "Ir para as obras",
    archive: "O arquivo da coleção",
    contact: "Contactar o estúdio",
    studioPhoto: "Uma obra no estúdio de Yulia Larkova",
    close: "Fechar imagem",
    expand: "Explorar a fotografia original",
    openMenu: "Abrir menu",
    closeMenu: "Fechar menu",
    loadingRoom: "A preparar a prévia do ambiente…",
    roomContext: "Outra perspetiva",
  },
};
