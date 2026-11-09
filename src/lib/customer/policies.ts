import type { Locale } from "../i18n.ts";
type Policy = {
  intro: string;
  original: string;
  shipping: string;
  damage: string;
  returns: string;
  privacy: string;
};
export const policies: Record<Locale, Policy> = {
  en: {
    intro:
      "This is a studio preview: no real payment is collected and no shipment is booked. Before any real purchase, the studio will confirm the artwork, price, destination, delivery charges and applicable order terms in writing.",
    original:
      "Every listing describes a physical original. Use the dimensions, materials, original photograph and any authentic detail photographs to judge the work. Room images show illustrative surroundings and approximate scale; frames and accessories are not included unless explicitly confirmed.",
    shipping:
      "Works are dispatched from Guatemala City. Delivery availability, timing and any included shipping depend on the destination, measured package and available service. International or special shipments may need a separate quote. Any customs, import taxes and arrangements for paying them must be confirmed before payment; do not assume they are included.",
    damage:
      "If a parcel or artwork arrives damaged, keep the packaging, photograph the parcel and artwork, and contact the studio promptly with your order reference. The studio will review the evidence and available carrier options with you before confirming a resolution. Do not return or discard the work without contacting the studio.",
    returns:
      "Contact the studio before canceling an order or sending an artwork back. Change-of-mind return eligibility, time limits, return-shipping costs and refund arrangements will be confirmed for your order before payment. These instructions do not limit any mandatory consumer rights that apply.",
    privacy:
      "Customer accounts store your name, email, password hash where used, provider identity and sessions, plus saved artwork IDs for favorites and cart. Google sign-in is optional; the studio never receives your Google password. Necessary account cookies keep you signed in; guests’ saved artwork IDs stay in browser storage. Transactional account emails use the configured email service. We do not subscribe you to marketing messages. Contact the studio for account-data correction or deletion. Saving or adding art to a cart does not reserve it.",
  },
  es: {
    intro:
      "Este es un sitio de prueba del estudio: no se cobran pagos reales ni se reservan envíos. Antes de una compra real, el estudio confirmará por escrito la obra, el precio, el destino, los gastos de entrega y las condiciones aplicables.",
    original:
      "Cada anuncio describe un original físico. Revisa medidas, materiales, fotografía original y detalles auténticos para valorar la obra. Las imágenes de interiores muestran entornos ilustrativos y escala aproximada; no incluyen marcos ni accesorios salvo confirmación expresa.",
    shipping:
      "Las obras salen de Ciudad de Guatemala. La disponibilidad, los plazos y cualquier envío incluido dependen del destino, el paquete medido y el servicio disponible. Los envíos internacionales o especiales pueden requerir cotización. Los aranceles, impuestos de importación y quién los paga se confirmarán antes del pago; no supongas que están incluidos.",
    damage:
      "Si el paquete o la obra llega dañado, conserva el embalaje, fotografía ambos y contacta pronto con el estudio indicando la referencia del pedido. Revisaremos las pruebas y opciones del transportista contigo antes de confirmar una solución. No devuelvas ni deseches la obra sin consultar.",
    returns:
      "Contacta con el estudio antes de cancelar un pedido o devolver una obra. La posibilidad de devolución por cambio de opinión, los plazos, costes de envío de devolución y reembolsos se confirmarán para tu pedido antes del pago. Estas instrucciones no limitan los derechos obligatorios del consumidor que correspondan.",
    privacy:
      "Las cuentas guardan nombre, correo, hash de contraseña cuando se usa, identidad del proveedor y sesiones, además de los identificadores de obras favoritas y del carrito. Google es opcional; el estudio nunca recibe tu contraseña de Google. Las cookies necesarias mantienen tu sesión; los invitados guardan identificadores de obras en el navegador. Los mensajes de cuenta usan el servicio de correo configurado. No te suscribimos a publicidad. Contacta con el estudio para corregir o eliminar datos. Guardar una obra o añadirla al carrito no la reserva.",
  },
  ru: {
    intro:
      "Это предварительная версия сайта студии: реальные платежи не принимаются, доставка не заказывается. Перед покупкой студия письменно подтвердит произведение, цену, адрес назначения, стоимость доставки и условия заказа.",
    original:
      "Каждое объявление представляет физический оригинал. Оценивайте работу по размерам, материалам, оригинальной фотографии и подлинным снимкам деталей. Интерьеры иллюстративны, масштаб приблизителен; рама и аксессуары не включены без отдельного подтверждения.",
    shipping:
      "Работы отправляются из города Гватемала. Возможность, сроки и включённая доставка зависят от страны назначения, измеренной упаковки и доступной службы. Для международной или особой доставки может потребоваться отдельный расчёт. Таможенные пошлины, налоги и порядок их оплаты согласуются до платежа; не считайте их включёнными.",
    damage:
      "При повреждении посылки или работы сохраните упаковку, сфотографируйте посылку и произведение и оперативно свяжитесь со студией, указав номер заказа. Мы рассмотрим материалы и возможности перевозчика вместе с вами до согласования решения. Не возвращайте и не выбрасывайте работу без обращения в студию.",
    returns:
      "Перед отменой заказа или возвратом произведения свяжитесь со студией. Возможность возврата при изменении решения, сроки, стоимость обратной доставки и порядок возмещения подтверждаются для заказа до оплаты. Эти инструкции не ограничивают обязательные права потребителя.",
    privacy:
      "Аккаунт хранит имя, почту, хеш пароля при его использовании, идентификатор провайдера и сеансы, а также ID избранных работ и корзины. Вход через Google необязателен; студия не получает пароль Google. Необходимые cookies поддерживают сеанс, а гостевые ID работ хранятся в браузере. Письма аккаунта отправляются через настроенный почтовый сервис. Рекламной подписки нет. Для исправления или удаления данных обратитесь в студию. Избранное и корзина не резервируют работу.",
  },
  zh: {
    intro:
      "本网站是工作室预览版：不会收取真实款项，也不会预约运输。实际购买前，工作室将书面确认作品、价格、目的地、运费及订单条款。",
    original:
      "每件商品均为实物原作。请根据尺寸、材料、原始照片和真实细节照片判断作品。室内图片仅作示意，比例为近似值；除非明确确认，否则不包含画框或配饰。",
    shipping:
      "作品从危地马拉城发出。配送范围、时效及是否包含运费取决于目的地、实测包裹和可用服务。国际或特殊运输可能需要单独报价。关税、进口税及支付安排须在付款前确认，请勿默认已包含。",
    damage:
      "如包裹或作品受损，请保留包装，拍摄包裹与作品，并尽快提供订单编号联系工作室。我们将与您核对证据和承运商可提供的处理方式，再确认解决方案。联系工作室前请勿退回或丢弃作品。",
    returns:
      "取消订单或寄回作品前，请先联系工作室。因改变主意而退货的资格、期限、退货运费和退款安排将在付款前按订单确认。本说明不限制适用的强制性消费者权利。",
    privacy:
      "账户保存姓名、邮箱、使用密码时的密码哈希、登录提供商身份与会话，以及收藏和购物车中的作品编号。Google 登录可选，工作室不会收到您的 Google 密码。必要 Cookie 用于保持登录，访客保存的作品编号保留在浏览器中。账户邮件通过已配置的邮件服务发送，我们不会自动订阅营销邮件。如需更正或删除数据，请联系工作室。收藏或加入购物车不会预留作品。",
  },
  ja: {
    intro:
      "このサイトはスタジオのプレビュー版です。実際の支払いや配送予約は行いません。購入前に、作品、価格、配送先、配送料、注文条件を書面で確認します。",
    original:
      "各作品は実物の一点物です。寸法、素材、オリジナル写真、実際の詳細写真をご確認ください。室内画像はイメージで、縮尺は概算です。明示的な確認がない限り額縁や小物は含まれません。",
    shipping:
      "作品はグアテマラシティから発送します。配送可否、日数、送料込みの条件は配送先、実測した梱包、利用可能なサービスによって異なります。海外・特別配送には別途見積もりが必要な場合があります。関税、輸入税、支払方法は購入前に確認し、含まれているとお考えにならないでください。",
    damage:
      "荷物や作品が破損していた場合は梱包を保管し、荷物と作品を撮影して、注文番号とともに速やかにご連絡ください。写真と運送会社の対応を一緒に確認したうえで解決方法をご案内します。連絡前に返送・廃棄しないでください。",
    returns:
      "注文のキャンセルや作品の返送前にスタジオへご連絡ください。お客様都合の返品可否、期限、返送料、返金方法は支払前に注文ごとに確認します。本案内は適用される強行的な消費者の権利を制限しません。",
    privacy:
      "アカウントには氏名、メール、使用時のパスワードハッシュ、プロバイダー識別情報とセッション、お気に入り・カートの作品IDを保存します。Googleログインは任意で、Googleのパスワードは受け取りません。必要なCookieでログインを維持し、ゲストの作品IDはブラウザーに保存します。アカウントのメールは設定済みサービスで送信し、宣伝メールに自動登録しません。データの訂正・削除はお問い合わせください。お気に入りやカートへの追加は作品の予約になりません。",
  },
  pt: {
    intro:
      "Este é um site de pré-visualização do estúdio: não cobra pagamentos reais nem reserva envios. Antes de uma compra real, confirmaremos por escrito a obra, o preço, o destino, os custos de entrega e os termos do pedido.",
    original:
      "Cada anúncio apresenta um original físico. Consulta dimensões, materiais, fotografia original e detalhes autênticos. Os interiores são ilustrativos e a escala é aproximada; molduras e acessórios não estão incluídos sem confirmação explícita.",
    shipping:
      "As obras partem da Cidade da Guatemala. A disponibilidade, os prazos e o transporte incluído dependem do destino, da embalagem medida e do serviço disponível. Envios internacionais ou especiais podem exigir orçamento separado. Direitos aduaneiros, impostos e respetivo pagamento devem ser confirmados antes da compra; não pressuponhas que estão incluídos.",
    damage:
      "Se a encomenda ou obra chegar danificada, guarda a embalagem, fotografa ambas e contacta rapidamente o estúdio com a referência do pedido. Analisaremos as provas e as opções da transportadora contigo antes de confirmar uma solução. Não devolvas nem descartes a obra sem nos contactar.",
    returns:
      "Contacta o estúdio antes de cancelar um pedido ou devolver uma obra. A elegibilidade para devolução por mudança de opinião, os prazos, o transporte de devolução e o reembolso serão confirmados para o pedido antes do pagamento. Estas instruções não limitam direitos obrigatórios do consumidor.",
    privacy:
      "As contas guardam nome, email, hash da palavra-passe quando usada, identidade do fornecedor e sessões, além dos IDs de obras favoritas e do carrinho. O Google é opcional; o estúdio nunca recebe a tua palavra-passe Google. Cookies necessários mantêm a sessão e os IDs de convidados ficam no navegador. Os emails de conta usam o serviço configurado; não te inscrevemos em publicidade. Contacta o estúdio para corrigir ou eliminar dados. Guardar ou adicionar ao carrinho não reserva uma obra.",
  },
};
