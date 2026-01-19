import { toNumber } from './number'

const roundVnd = (value) => Math.round(toNumber(value, 0))

export function computeInvoiceAmounts(invoice) {
  const basePrice = roundVnd(
    toNumber(invoice?.base_price, toNumber(invoice?.total_amount, 0))
  )

  const deposit = roundVnd(invoice?.deposit)
  const extraFee = roundVnd(invoice?.extra_fee)
  const penaltyFee = roundVnd(invoice?.penalty_fee)
  const tip = roundVnd(invoice?.tip)

  const surcharge = extraFee + penaltyFee + tip

  const surchargeForBill = extraFee + penaltyFee

  const totalAmount = roundVnd(
    toNumber(invoice?.total_amount, basePrice + surcharge)
  )

  const remainingAmount = Math.max(totalAmount - deposit, 0)

  return {
    basePrice,
    deposit,
    extraFee,
    penaltyFee,
    tip,
    surcharge,
    totalAmount,
    remainingAmount,
    surchargeForBill
  }
}
