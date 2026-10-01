var fs = require('fs');
var express = require('express');
var mustache = require('mustache');
var router = express.Router();
const { isAdmin } = require('../lib/admins');

var machines = require('../model/machines');

var base = fs.readFileSync('./template/base.html').toString();

// Machine codes are uppercase letters and digits; template/machines.html applies
// the same rule as the admin types.
var MACHINE_KEY_MAX_LENGTH = 20;

function canEditMachines(ukey) {
  return isAdmin(ukey);
}

function normalizeMachineKey(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, MACHINE_KEY_MAX_LENGTH);
}

router.get('/machines',function(req,res) {
  var template = fs.readFileSync('./template/machines.html').toString();
  var ukey = req.user.key || 'ANON';

  var canAdd = canEditMachines(ukey);
  var canRemove = canEditMachines(ukey);
  var list = machines.all();

  console.log('# machines:',list.length);

  list.sort(function(a,b) {
    if(a.name == b.name) return 0;
    var check = [a.name, b.name];
    check.sort();
    if(check[0] == a.name) return -1;
    return 1;
  });

  var html = mustache.render(base, {
    title: 'Machines',
    machines: list,
    canAdd: canAdd,
    canRemove: canRemove
  }, {
    content: template
  });

  res.send(html);
});

router.post('/machines',function(req,res) {
  var ukey = req.user.key;
  var key = normalizeMachineKey(req.body.mkey);
  var name = String(req.body.name || '').trim();
  if (canEditMachines(ukey) && key && name) {
    machines.add({
      key: key,
      name: name
    });

    var check = machines.get(key);
    console.log('check:',check);
  }

  res.redirect('/machines');
});

router.post('/machines/:machine_key/remove',function(req,res) {
  var ukey = req.user.key;
  if (canEditMachines(ukey)) {
    machines.remove({
      key: req.body.mkey
    });

    var check = machines.get(req.body.mkey);
    console.log('check:',check);
  }

  res.redirect('/machines');
});

module.exports = router;
