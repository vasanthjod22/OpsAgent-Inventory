const calculateWeightedAverageCost = (existingQty, existingRate, incomingQty, incomingRate) => {
  const existingQtyNum = Number(existingQty) || 0
  const existingRateNum = Number(existingRate) || 0
  const incomingQtyNum = Number(incomingQty) || 0
  const incomingRateNum = Number(incomingRate) || 0

  const existingValue = existingQtyNum * existingRateNum
  const incomingValue = incomingQtyNum * incomingRateNum
  const totalQty = existingQtyNum + incomingQtyNum

  if (existingQtyNum === 0) {
    return incomingRateNum
  }

  if (incomingQtyNum === 0) {
    return existingRateNum
  }

  const weightedAvgRate = (existingValue + incomingValue) / totalQty

  return Math.round(weightedAvgRate * 100) / 100
}

console.log('Testing weighted average:')
console.log(calculateWeightedAverageCost(3, 70, 10, 80))
// Should output: 77.69

console.log('Total value check:')
console.log(3 * 70 + 10 * 80) // 1010
console.log(77.69 * 13) // ~1010 (matches!)
