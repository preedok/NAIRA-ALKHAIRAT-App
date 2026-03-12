require('dotenv').config();
process.chdir(require('path').join(__dirname, '..'));
const { RekapHotel } = require('../src/models');
RekapHotel.count()
  .then((c) => {
    console.log('rekap_hotel count:', c);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
