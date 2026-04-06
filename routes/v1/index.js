const router = require('express').Router();
const { requireAuth } = require('../../middleware/requireAuth');

// Auth routes — public (no token required)
router.use('/auth', require('./auth'));

// All routes below require a valid JWT
router.use(requireAuth);

router.use('/user',      require('./user'));
router.use('/tags',      require('./tags'));
router.use('/notes',     require('./notes'));
router.use('/inbox',     require('./inbox'));
router.use('/journal',   require('./journal'));
router.use('/reviews',   require('./reviews'));
router.use('/skills',    require('./skills'));
router.use('/resources', require('./resources'));
router.use('/learning',  require('./learning'));
router.use('/goals',     require('./goals'));
router.use('/projects',  require('./projects'));
router.use('/tasks',     require('./tasks'));
router.use('/habits',    require('./habits'));
router.use('/health',    require('./health'));
router.use('/workouts',  require('./workouts'));
router.use('/finance',   require('./finance'));
router.use('/people',    require('./people'));
router.use('/media',     require('./media'));
router.use('/places',    require('./places'));
router.use('/trips',     require('./trips'));
router.use('/hobbies',   require('./hobbies'));
router.use('/search',    require('./search'));
router.use('/dashboard', require('./dashboard'));

module.exports = router;
