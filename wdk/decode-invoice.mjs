import rgblib from '@utexo/rgb-lib-bare'

let invoice
let result
try {
  invoice = new rgblib.Invoice(Bare.argv[2])
  const raw = invoice.invoiceData()
  result = { decoded: typeof raw === 'string' ? JSON.parse(raw) : raw }
} catch {
  result = { decoded: null }
} finally {
  invoice?.drop()
}
console.log(JSON.stringify(result))
