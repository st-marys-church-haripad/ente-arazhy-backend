const router = require('express').Router();

// Base Route\
router.get('/', (req, res) => {
    res.status(200).json({ 
        message: 'Welcome to Ente Arazhy Backend!',
        version: '1.0.0',
        status: 'OK',
        timeStamp: new Date().toISOString()
    });
});

router.use('/auth', require('./v1/auth.routes'));
router.use('/churches', require('./v1/churches.routes'));
router.use('/divisions', require('./v1/divisions.routes'));
router.use('/events', require('./v1/events.routes'));
router.use('/families', require('./v1/families.routes'));
router.use('/members', require('./v1/members.routes'));
router.use('/misc', require('./v1/misc.routes'));

module.exports = router;