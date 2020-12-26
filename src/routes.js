const { PRODUCT_DETAIL_URL, OFFERS_LISTING_URL, PRODUCT_DETAIL_LABEL, PRODUCT_OFFERS_LABEL } = require('./constatnts')

exports.handleList = async (page, queue) => {
    const asins = await page.$$eval('.s-result-item', async (items) => {
        return items.map((item) => item.dataset.asin).filter((item) => item !== '' && item !== undefined)
    })

    asins.forEach(async (asin) => {
        await queue.addRequest({ url: PRODUCT_DETAIL_URL + asin, userData: { label: PRODUCT_DETAIL_LABEL, asin } })
        console.info('ASIN loaded for crawling detail: ' + asin)
    })
}

exports.handleDetail = async (page, asin, queue) => {
    const itemData = await page.evaluate(() => {
        const titleEl = document.getElementById('productTitle')
        if (!titleEl) {
            return false
        }

        const title = titleEl.innerText
        const url = document.URL
        const descriptionEl = document.getElementById('productDescription')
        let description = null

        if (descriptionEl) {
            description =
                descriptionEl.textContent.replace(/\s+/g, ' ').trim() ||
                descriptionEl.innerText.replace(/\s+/g, ' ').trim() ||
                ''
        }

        return { title, url, description }
    })

    // not in stock - no offers
    if (!itemData) {
        return
    }

    await queue.addRequest({ url: OFFERS_LISTING_URL + asin, userData: { label: PRODUCT_OFFERS_LABEL, itemData } })
}

exports.handleOffers = async (page, keyword, itemData, dataset) => {
    const offers = await page.evaluate(async () => {
        const offers = Array.from(document.querySelectorAll('.olpOffer'))

        return offers.map((offer) => {
            const price = offer.querySelector('.olpOfferPrice').innerText
            const seller = offer.querySelector('.olpSellerName').innerText

            return { price, seller }
        })
    })

    for (offer of offers) {
        await dataset.pushData({ ...itemData, ...offer, keyword })
    }
}
