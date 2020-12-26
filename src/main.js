const Apify = require('apify')
const { handleList, handleDetail, handleOffers } = require('./routes')
const { PRODUCT_DETAIL_LABEL, PRODUCT_OFFERS_LABEL } = require('./constatnts')

Apify.main(async () => {
    const dataset = await Apify.openDataset('default')

    const proxyConfiguration = await Apify.createProxyConfiguration()

    // const { keyword } = await Apify.getInput();
    const keyword = 'phone'

    const searchUrl = 'https://www.amazon.com/s/ref=nb_sb_noss?url=search-alias%3Daps&field-keywords=' + keyword

    const requestQueue = await Apify.openRequestQueue()
    await requestQueue.addRequest({ url: searchUrl })

    const crawler = new Apify.PuppeteerCrawler({
        requestQueue,
        proxyConfiguration,
        launchPuppeteerOptions: { headless: false, useApifyProxy: true },
        handlePageFunction: async ({
            request: {
                url,
                userData: { label, itemData, asin },
            },
            page,
        }) => {
            switch (label) {
                case PRODUCT_DETAIL_LABEL:
                    await handleDetail(page, asin, requestQueue)
                    break
                case PRODUCT_OFFERS_LABEL:
                    await handleOffers(page, keyword, itemData, dataset)
                    break
                default:
                    await handleList(page, requestQueue)
                    break
            }
        },
    })

    await crawler.run()

    // const data = await dataset.getData()
    // const keyValueStore = await Apify.openKeyValueStore('store', {
    //     forceCloud: true,
    // })
    // await keyValueStore.setValue('offers', data)
    // const storePublicURL = keyValueStore.getPublicUrl('offers')

    // await Apify.call('apify/send-mail', {
    //     to: 'lukas@apify.com',
    //     subject: 'Amazon products offers - exercise',
    //     html: `<p>Ahoj, posielam link na .json pre amazon.</p> <br /> <a href="${storePublicURL}">${storePublicURL}</a> <br/> <p>Vladimir Vais - BOOTIQ</p>`,
    // })
})
