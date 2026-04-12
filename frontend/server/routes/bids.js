const router = require('express').Router()
router.get('/', (req, res) => res.json({ data: [], total: 0 }))
router.post('/:id/award', (req, res) => res.json({ success: true, message: 'Award processed' }))
module.exports = router
