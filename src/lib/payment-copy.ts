import type { Locale } from "./i18n";
const en = {
  pay: "Continue to test payment",
  pending: "Checking your test payment…",
  paid: "Your sandbox payment is confirmed.",
  expired: "This test checkout has expired.",
  review: "Your test order is awaiting verification.",
  verify: "Check payment status",
  intro:
    "Use fictional details and the provider’s test card. No real money is collected. Shipping requests stay in the courier’s test environment.",
  phone: "Phone number",
  region: "State / province",
  setup:
    "Shipping needs a quote or packed measurements before checkout. Please contact the studio.",
  note: "Sandbox transaction · no real payment or courier collection",
};
type PaymentCopy = typeof en;
export const paymentCopy: Record<Locale, PaymentCopy> = {
  en,
  es: {
    pay: "Continuar al pago de prueba",
    pending: "Verificando tu pago de prueba…",
    paid: "Tu pago de prueba está confirmado.",
    expired: "Este pago de prueba ha vencido.",
    review: "Tu pedido de prueba está pendiente de verificación.",
    verify: "Verificar estado del pago",
    intro:
      "Usa datos ficticios y la tarjeta de prueba del proveedor. No se cobra dinero real. Los envíos se solicitan solo en el entorno de prueba del transportista.",
    phone: "Teléfono",
    region: "Departamento / provincia",
    setup:
      "El envío requiere una cotización o medidas del paquete antes del pago. Contacta al estudio.",
    note: "Transacción de prueba · sin pago ni recogida reales",
  },
  ru: {
    pay: "Перейти к тестовой оплате",
    pending: "Проверяем тестовую оплату…",
    paid: "Тестовая оплата подтверждена.",
    expired: "Срок тестовой оплаты истёк.",
    review: "Тестовый заказ ожидает проверки.",
    verify: "Проверить статус оплаты",
    intro:
      "Используйте вымышленные данные и тестовую карту провайдера. Реальные деньги не списываются. Доставка оформляется только в тестовой среде перевозчика.",
    phone: "Телефон",
    region: "Регион / область",
    setup:
      "Перед оплатой нужен расчёт доставки или размеры упаковки. Свяжитесь с мастерской.",
    note: "Тестовая операция · без реальной оплаты и вызова курьера",
  },
  zh: {
    pay: "继续测试付款",
    pending: "正在核实测试付款…",
    paid: "测试付款已确认。",
    expired: "此测试结账已过期。",
    review: "测试订单正在等待核实。",
    verify: "查看付款状态",
    intro:
      "请使用虚构资料和服务商的测试卡。不会收取真实款项。配送申请仅在快递公司的测试环境中进行。",
    phone: "电话号码",
    region: "州 / 省",
    setup: "付款前需要配送报价或包裹尺寸，请联系工作室。",
    note: "测试交易 · 无真实付款或快递取件",
  },
  ja: {
    pay: "テスト決済に進む",
    pending: "テスト決済を確認中…",
    paid: "テスト決済を確認しました。",
    expired: "テスト決済の有効期限が切れました。",
    review: "テスト注文は確認待ちです。",
    verify: "決済状況を確認",
    intro:
      "架空の情報と決済会社のテストカードをご使用ください。実際の請求はありません。配送依頼は運送会社のテスト環境でのみ行います。",
    phone: "電話番号",
    region: "州 / 都道府県",
    setup:
      "決済前に配送見積もりや梱包サイズの確認が必要です。アトリエにお問い合わせください。",
    note: "テスト取引 · 実際の請求や集荷はありません",
  },
  pt: {
    pay: "Continuar para o pagamento de teste",
    pending: "Verificando seu pagamento de teste…",
    paid: "Seu pagamento de teste foi confirmado.",
    expired: "Este checkout de teste expirou.",
    review: "Seu pedido de teste aguarda verificação.",
    verify: "Verificar status do pagamento",
    intro:
      "Use dados fictícios e o cartão de teste do provedor. Não há cobrança real. As solicitações de envio ficam no ambiente de teste da transportadora.",
    phone: "Telefone",
    region: "Estado / província",
    setup:
      "O envio precisa de orçamento ou medidas da embalagem antes do pagamento. Entre em contato com o ateliê.",
    note: "Transação de teste · sem pagamento ou coleta reais",
  },
};
