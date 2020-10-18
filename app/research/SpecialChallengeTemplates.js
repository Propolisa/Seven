PARSE SPECIAL CHALLENGES

// Get flag names
var specialChallenge = {}

specialChallenge['name'] = $('.luna-nav').find('li.active').find('span').remove().end().text().trim()
specialChallenge['flagOwns'] = Object.fromEntries($('.far.fa-circle:visible').map((idx,ele) => ([[ele.nextSibling.nextSibling.innerText,[]]])).get())

// Get description data
specialChallenge['description'] = $('#descriptionTab').find('.panel-body').find('p, li').map(function (idx, ele) {
   if (ele.innerText && $(ele).children().length == 0){return ($(ele).is('li') ? ele.innerText : ele.innerText +'\n' );}
}).get().join("\n");

// Get entry points / IPs (if existing):
specialChallenge['entries'] = $('code').map((idx,ele) => ele.innerText).get()

// Get makers (if relevant):

specialChallenge['makers'] = $('#descriptionTab, .header-title').find("a[href*='/home/users/profile/']").map((idx,ele) => {return {username:ele.innerText, id:Number(ele.href.substring(45))}})[0]

// Find if lab is retired:

specialChallenge['retired'] = $('.fa-file-pdf').length > 0

console.log(specialChallenge)
/*
FORMAT:
[
  {
    "username": "MinatoTW",
    "id": 8308
  },
  {
    "username": "Keramas",
    "id": 28293
  }
]
*/