function amtWords(amt) {
    const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
      'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
    const tensW = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
    const nW = (n) => {
      if (n === 0) return ''
      if (n < 20) return ones[n]
      if (n < 100) return tensW[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '')
      if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' '+nW(n%100) : '')
      if (n < 100000) return nW(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' '+nW(n%1000) : '')
      if (n < 10000000) return nW(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' '+nW(n%100000) : '')
      return nW(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' '+nW(n%10000000) : '')
    }
    const rs = Math.floor(amt)
    const ps = Math.round((amt - rs) * 100)
    let res = nW(rs) + ' Rupees'
    if (ps > 0) res += ' and ' + nW(ps) + ' Paise'
    return res + ' Only'
}
console.log(amtWords(8134.33));
