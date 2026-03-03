const Parser = require('rss-parser');
const parser = new Parser({
    customFields: {
        item: [
            ['media:content', 'mediaContent', {keepArray: true}],
            ['media:thumbnail', 'mediaThumbnail', {keepArray: true}],
            ['media:group', 'mediaGroup'],
            ['content:encoded', 'contentEncoded'],
            ['enclosure', 'enclosure']
        ]
    }
});

async function test() {
    try {
        const feed = await parser.parseURL('https://gamek.vn/trang-chu.rss');
        console.log('=== First 3 items ===\n');
        
        feed.items.slice(0, 3).forEach((item, i) => {
            console.log(`--- Item ${i + 1} ---`);
            console.log('Title:', item.title);
            console.log('Link:', item.link);
            console.log('GUID:', item.guid);
            console.log('All keys:', Object.keys(item));
            console.log('\n');
        });
    } catch (err) {
        console.error('Error:', err.message);
    }
}

test();
