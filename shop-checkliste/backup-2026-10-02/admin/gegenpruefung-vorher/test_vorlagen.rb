# encoding: utf-8
# Testet die Liquid-Vorlagen aus obsidian/LimitlessPoster/vorlagen/ mit der
# Shopify-Liquid-Referenzimplementierung (Ruby-Gem "liquid", strict parsing)
# und Beispiel-Bestellungen. Aufruf:  ruby test_vorlagen.rb
# Ergebnis: Vorschau-HTML-Dateien in vorschau/ und Pruefausgabe im Terminal.
require "liquid"
require "time"
require "fileutils"

module ShopifyMockFilters
  # Shopify-Format des Shops: "€{{amount_with_comma_separator}}" -> ohne Waehrung "1.234,56"
  def money_without_currency(cents)
    c = cents.to_i
    neg = c < 0
    c = c.abs
    euro = (c / 100).to_s.reverse.scan(/\d{1,3}/).join(".").reverse
    (neg ? "-" : "") + format("%s,%02d", euro, c % 100)
  end

  def money(cents)
    "€" + money_without_currency(cents)
  end
end
Liquid::Environment.default.register_filter(ShopifyMockFilters)

BASE = File.expand_path("../../../obsidian/LimitlessPoster/vorlagen", __dir__)
OUT = File.join(__dir__, "vorschau")
FileUtils.mkdir_p(OUT)

def addr(first, last, street, zip, city, company = nil)
  { "first_name" => first, "last_name" => last, "name" => "#{first} #{last}", "company" => company,
    "address1" => street, "address2" => nil, "zip" => zip, "city" => city,
    "country" => "Germany", "translated_country_name" => "Deutschland" }
end

def li(title, size, frame, price, qty, sku)
  { "title" => "#{title} - #{size} / #{frame}", "quantity" => qty, "sku" => sku,
    "original_price" => price, "original_line_price" => price * qty,
    "product" => { "title" => title },
    "variant" => { "title" => "#{size} / #{frame}" },
    "options_with_values" => [{ "name" => "Size", "value" => size }, { "name" => "Color", "value" => frame }] }
end

SHOP = { "name" => "LimitlessPoster", "email_logo_url" => "", "url" => "https://limitlessposter.com" }

orders = {
  "1-paypal-gratisversand" => {
    "name" => "#1001", "order_number" => 1001, "email" => "kundin@example.com",
    "created_at" => Time.parse("2026-10-05T10:15:00+02:00"),
    "billing_address" => addr("Anna", "Muster", "Hauptstraße 1", "70173", "Stuttgart"),
    "shipping_address" => addr("Anna", "Muster", "Hauptstraße 1", "70173", "Stuttgart"),
    "line_items" => [li("Dressurpferd", "46 × 61 cm", "Black", 8199, 1, "LP-0001")],
    "discount_applications" => [{ "target_type" => "shipping_line", "title" => "Kostenloser Versand Deutschland", "total_allocated_amount" => 2319 }],
    "shipping_methods" => [{ "title" => "Standard Delivery", "original_price" => 2319, "price_with_discounts" => 0 }],
    "fulfillments" => [], "tax_price" => 0, "total_price" => 8199, "total_refunded_amount" => 0,
    "financial_status" => "paid", "cancelled" => false,
    "transactions" => [{ "status" => "success", "kind" => "sale", "gateway" => "paypal", "gateway_display_name" => "PayPal",
                         "created_at" => Time.parse("2026-10-05T10:15:30+02:00"), "payment_details" => {} }]
  },
  "2-rabatt-versendet-karte" => {
    "name" => "#1002", "order_number" => 1002, "email" => "max@example.com",
    "created_at" => Time.parse("2026-10-06T21:40:00+02:00"),
    "billing_address" => addr("Max", "Beispiel", "Ringweg 7", "10115", "Berlin", "Beispiel GmbH"),
    "shipping_address" => addr("Max", "Beispiel", "Packstation 123", "10117", "Berlin"),
    "line_items" => [li("Golden Hour", "61 × 91 cm", "White", 8199, 1, "LP-0002"), li("Ring Legend", "30 × 41 cm", "Black", 5499, 2, "")],
    "discount_applications" => [{ "target_type" => "line_item", "title" => "WILLKOMMEN10", "total_allocated_amount" => 1920 },
                                { "target_type" => "shipping_line", "title" => "Kostenloser Versand Deutschland", "total_allocated_amount" => 4638 }],
    "shipping_methods" => [{ "title" => "Standard Delivery", "original_price" => 4638, "price_with_discounts" => 0 }],
    "fulfillments" => [{ "created_at" => Time.parse("2026-10-09T08:00:00+02:00") }, { "created_at" => Time.parse("2026-10-09T09:00:00+02:00") }],
    "tax_price" => 0, "total_price" => 17277, "total_refunded_amount" => 0,
    "financial_status" => "paid", "cancelled" => false,
    "transactions" => [{ "status" => "success", "kind" => "sale", "gateway" => "shopify_payments", "gateway_display_name" => "Shopify Payments",
                         "created_at" => Time.parse("2026-10-06T21:40:10+02:00"), "payment_details" => { "credit_card_company" => "Visa" } }]
  },
  "3-fehlerfall-steuer-storno" => {
    "name" => "#1003", "order_number" => 1003, "email" => "test@example.com",
    "created_at" => Time.parse("2026-10-07T12:00:00+02:00"), "cancelled_at" => Time.parse("2026-10-08T12:00:00+02:00"),
    "billing_address" => nil,
    "shipping_address" => addr("Tina", "Test", "Testweg 2", "73732", "Esslingen am Neckar"),
    "line_items" => [li("Dressurpferd", "28 × 36 cm", "White", 4999, 1, "")],
    "discount_applications" => [], "shipping_methods" => [{ "title" => "Standard Delivery", "original_price" => 0, "price_with_discounts" => 0 }],
    "fulfillments" => [], "tax_price" => 950, "total_price" => 5949, "total_refunded_amount" => 5949,
    "financial_status" => "refunded", "cancelled" => true,
    "transactions" => [{ "status" => "success", "kind" => "sale", "gateway" => "bogus", "gateway_display_name" => "(For Testing) Bogus Gateway",
                         "created_at" => Time.parse("2026-10-07T12:00:05+02:00"), "payment_details" => {} }]
  }
}

ok = true
# 1) Rechnung (Order Printer)
src = File.read(File.join(BASE, "Order Printer Rechnung (§ 19).liquid"), encoding: "UTF-8")
tpl = Liquid::Template.parse(src, error_mode: :strict)
orders.each do |key, order|
  html = tpl.render!({ "order" => order, "shop" => SHOP }, strict_filters: true)
  html = "<!doctype html><html lang=\"de\"><head><meta charset=\"utf-8\"><title>Rechnung #{order["name"]}</title></head><body>#{html}</body></html>"
  File.write(File.join(OUT, "rechnung-#{key}.html"), html, encoding: "UTF-8")
  text = html.gsub(/<[^>]+>/, " ").gsub(/\s+/, " ")
  checks = {
    "kein Liquid-Rest" => !html.include?("{{") && !html.include?("{%"),
    "Rechnungsnummer" => text.include?("RE-#{order["order_number"]}"),
    "§ 19-Hinweis" => text.include?("§ 19 UStG"),
    "USt-IdNr." => text.include?("DE463961672"),
    "Gesamtbetrag" => text.include?("Gesamtbetrag " + ShopifyMockFilters.instance_method(:money_without_currency).bind(Object.new.extend(ShopifyMockFilters)).call(order["total_price"]) + " €"),
    "kein MwSt-Ausweis" => !(text =~ /MwSt|Mehrwertsteuer|zzgl\./),
    "Englisch übersetzt" => !(text =~ /Standard Delivery|\bBlack\b|\bWhite\b|Size:|Color:|Germany/)
  }
  checks["Warnung bei Steuer"] = text.include?("ACHTUNG") if order["tax_price"].to_i > 0
  checks["Versand 0 €"] = text.include?("kostenlos 0,00 €") if order["tax_price"].to_i == 0
  checks.each { |k, v| ok &&= v; puts format("%-34s %-22s %s", "rechnung-#{key}", k, v ? "OK" : "FEHLER") }
end

# 2) Bestellbestaetigung-Baustein (Shopify-Benachrichtigung)
bs_path = File.join(BASE, "Bestellbestätigung Zusatzbaustein (§ 19, Lieferzeit, Widerruf, AGB).liquid")
if File.exist?(bs_path)
  bs = Liquid::Template.parse(File.read(bs_path, encoding: "UTF-8"), error_mode: :strict)
  html = bs.render!({ "shop" => SHOP, "order_name" => "#1001", "name" => "#1001", "order_status_url" => "https://limitlessposter.com/orders/x" }, strict_filters: true)
  File.write(File.join(OUT, "bestellbestaetigung-baustein.html"), "<!doctype html><html lang=\"de\"><head><meta charset=\"utf-8\"><title>Baustein</title></head><body style=\"background:#fff\">#{html}</body></html>")
  text = html.gsub(/<[^>]+>/, " ").gsub(/\s+/, " ")
  { "kein Liquid-Rest" => !html.include?("{{") && !html.include?("{%"),
    "§ 19-Hinweis" => text.include?("§ 19 UStG"),
    "Lieferzeit 4–10" => text.include?("4–10 Werktage"),
    "Widerrufsbelehrung" => text.include?("Muster-Widerrufsformular") && text.include?("vierzehn Tagen"),
    "AGB § 1–§ 13" => text.include?("§ 1 Geltungsbereich") && text.include?("§ 13 Schlussbestimmungen"),
    "Kontakt" => text.include?("limitless.posterje@gmail.com"),
    "keine EU-Lieferung" => !(text =~ /in die Länder der Europäischen Union|und der EU/) }.each do |k, v|
    ok &&= v
    puts format("%-34s %-22s %s", "bestellbestaetigung-baustein", k, v ? "OK" : "FEHLER")
  end
end

puts ok ? "\nALLE PRÜFUNGEN OK" : "\nES GIBT FEHLER"
exit(ok ? 0 : 1)
