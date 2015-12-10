
//
// Players

function Players(map) {
  map = map || {};
  var players = {};
  for (var id in map) // defensive copy
    players[id] = map[id];

  var hasColor = function(playerId, color) {
    var playerColor = players[playerId];
    return playerColor == color || playerColor == Players.BOTH;
  };

  var isBlack = function(playerId) { return hasColor(playerId, Players.BLACK); };

  var isWhite = function(playerId) { return hasColor(playerId, Players.WHITE); };

  // public methods

  this.hasColor = hasColor;
  this.isBlack = isBlack;
  this.isWhite = isWhite;

  this.synchronize = function() {
    var newPlayers = {};
    var host = wave.getHost();
    var participants = wave.getParticipants();
    for (var i = 0; i < participants.length; i++) {
      var id = participants[i].getId();
      newPlayers[id] = id in players ? players[id] : (!host || id == host.getId() ? Players.BLACK : Players.WHITE);
    }
    players = newPlayers;
  };

  this.getNames = function() {
    var black = '', white = '';
    var participants = wave.getParticipants();
    for (var i = 0; i < participants.length; i++) {
      var id = participants[i].getId();
      var name = participants[i].getDisplayName();
      if (isBlack(id))
        black += ', ' + name;
      if (isWhite(id))
        white += ', ' + name;
    }
    return { black: black ? black.slice(2) : '*black*', white: white ? white.slice(2) : '*white*' };
  };

  this.addBlack = function(playerId, state) {
    if (state && !isBlack(playerId)) {
      players[playerId] = isWhite(playerId) ? Players.BOTH : Players.BLACK;
    } else if (!state && isBlack(playerId)) {
      players[playerId] = isWhite(playerId) ? Players.WHITE : Players.NONE;
    }
  };

  this.addWhite = function(playerId, state) {
    if (state && !isWhite(playerId)) {
      players[playerId] = isBlack(playerId) ? Players.BOTH : Players.WHITE;
    } else if (!state && isWhite(playerId)) {
      players[playerId] = isBlack(playerId) ? Players.BLACK : Players.NONE;
    }
  };

  this.toString = function() {
    var s = '';
    for (var id in players)
      s += players[id] + id + '\t';
    return s;
  };
}

// static methods

Players.parse = function(s) {
  var map = {};
  var a = s.split('\t');
  for (var i in a)
    if (a[i].length > 2)
      map[a[i].slice(1)] = parseInt(a[i].charAt(0));
  return new Players(map);
};

// static fields

Players.NONE = 0;
Players.BLACK = 1;
Players.WHITE = 2;
Players.BOTH = 3;


//
// Game Log Section
//

var LogUtils = {
  encode: function(n) { return '0123456789abcdefghijklmnopqrstuvwxyz'.charAt(n); },
  decode: function(c) { return '0123456789abcdefghijklmnopqrstuvwxyz'.indexOf(c); }
};

//
// FollowUp

function FollowUp(type, pos) {
  this.type = type;
  this.i = pos.i;
  this.j = pos.j;

  this.eq = function(o) {
    return o && this.type == o.type && this.i == o.i && this.j == o.j;
  };

  this.toString = function() {
    return FollowUp.encode(this.type) + LogUtils.encode(this.i) + LogUtils.encode(this.j);
  };
}

// static methods

FollowUp.parse = function(getc) {
  var type = FollowUp.decode(getc(true));
  var i = LogUtils.decode(getc(true));
  var j = LogUtils.decode(getc(true));
  return new FollowUp(type, { i: i, j: j });
};

FollowUp.encode = function(n) { return n > 0 ? FollowUp.TYPECODES.charAt(n) : '?'; };

FollowUp.decode = function(c) {
  return FollowUp.TYPECODES.indexOf(c);
};

// static fields

FollowUp.TYPECODES = '?%-#*.bw';

FollowUp.KO = 1;
FollowUp.CAPTURE = 2;
FollowUp.MARK_AS_DEAD = 3;
FollowUp.MARK_AS_LIVING = 4;
FollowUp.MARK_AS_NEUTRAL = 5;
FollowUp.MARK_AS_BLACK = 6;
FollowUp.MARK_AS_WHITE = 7;

//
// LogEntry

function LogEntry(type, pos, player) {
  var codes = 'abcdefghijklmnopqrstuvwxy';

  // public variables

  this.type = type;
  this.i = pos.i;
  this.j = pos.j;
  this.player = player;
  this.followUps = [];

  // public methods

  this.addFollowUp = function(followUp) {
    if (followUp.type > 0 && this.followUps.length < 19 * 19)
      this.followUps.push(followUp);
  };

  this.eq = function(o) {
    if (!o || this.type != o.type || this.i != o.i || this.j != o.j || this.player != o.player || this.followUps.length != o.followUps.length)
      return false;
    for (var i in this.followUps)
      if (!this.followUps[i].eq(o.followUps[i]))
        return false;
    return true;
  };

  this.toSgf = function(prefix) {
    if (this.type == LogEntry.MARK)
      return '';
    return (this.player == Players.BLACK ? '\n' + prefix + ';B[' : ';W[') + (this.type == LogEntry.PASS ? '' : codes.charAt(this.i) + codes.charAt(this.j)) + ']';
  };

  this.toString = function() {
    var s = '';
    if (this.type == LogEntry.PASS) {
      s += this.player == Players.BLACK ? '<' : '>';
    } else if (this.type == LogEntry.PUT) {
      s += (this.player == Players.BLACK ? 'B' : 'W') + LogUtils.encode(this.i) + LogUtils.encode(this.j);
    } else if (this.type == LogEntry.MARK) {
      s += '!' + LogUtils.encode(this.i) + LogUtils.encode(this.j);
    }
    for (var k in this.followUps)
      s += this.followUps[k].toString();
    return s;
  };
}

// static methods

LogEntry.parse = function(getc) {
  var getEntryPlayer = function(c) { return c == '!' ? Players.BOTH : ('<B'.indexOf(c) >= 0 ? Players.BLACK : Players.WHITE); };
  var entry = null;
  if ('<>'.indexOf(getc()) >= 0) {
    entry = new LogEntry(LogEntry.PASS, { i: 0, j: 0 }, getEntryPlayer(getc(true)));
  } else if ('BW!'.indexOf(getc()) >= 0) {
    var type = getc() == '!' ? LogEntry.MARK : LogEntry.PUT;
    var player = getEntryPlayer(getc(true));
    var i = LogUtils.decode(getc(true));
    var j = LogUtils.decode(getc(true));
    entry = new LogEntry(type, { i: i, j: j }, player);
  }
  while (entry && getc() && FollowUp.TYPECODES.indexOf(getc()) > 0)
    entry.addFollowUp(FollowUp.parse(getc));
  return entry;
};

// static fields

LogEntry.PUT = 1;
LogEntry.PASS = 2;
LogEntry.MARK = 3;

//
// GameLogNode

function GameLogNode(entry, prev, next, altnext) {

  // getters and setters

  this.entry = function() { return entry; };
  this.prev = function() { return prev; };
  this.set_prev = function(node) { prev = node; };
  this.next = function() { return next; };
  this.set_next = function(node) { next = node; };
  this.altnext = function() { return altnext; };
  this.set_altnext = function(node) { altnext = node; };
  this.alt = function() { return prev && prev.altnext() == this; };

  // public methods

  this.toString = function() {
    var s = '';
    for (var node = this; node; node = node.next())
      s += node.entry().toString() + (node.altnext() ? '(' + node.altnext().toString() + ')' : '');
    return s;
  };

  this.toSgfBranch = function(prefix) {
    var s = '';
    for (var node = this; node; node = node.altnext())
      s += '\n' + prefix + '(' + node.entry().toSgf(prefix + ' ') + (node.next() ? node.next().toSgfFull(prefix + ' ') : '') + ')';
    return s;
  };

  this.toSgfFull = function(prefix) {
    var s = '';
    for (var node = this; node; node = node.next()) {
      if (node.altnext())
        return s + node.toSgfBranch(prefix + ' ')
      s += node.entry().toSgf(prefix);
    }
    return s;
  };

  this.toSgf = function(target) {
    if (!target)
      return this.toSgfFull('');
    var s = '';
    var node = null;
    for (var i = 0; i < target.length; i++) {
      node = node && node.altnext() || this;
      var n = parseInt(target[i]);
      for (var j = 0; j < n; j++) {
        s += node ? node.entry().toSgf('') : '';
        node = node && node.next();
      }
    }
    return node ? s + node.entry().toSgf('') : s;
  };

  // initialization

  if (prev)
    prev.set_next(this);
  if (next)
    next.set_prev(this);
  if (altnext)
    altnext.set_prev(this);
}

// static methods

GameLogNode.parse = function(s) {
  var pos = 0;
  var getc = function(next) { return pos < s.length ? s.charAt(next ? pos++ : pos) : ''; };
  var parse = function() {
    var node = null, last = null;
    while (getc() && getc() != ')') {
      var entry = LogEntry.parse(getc);
      var alt = null;
      if (getc() && getc() == '(') { // parse alt branch
        getc(true); // skip '('
        alt = parse(); // recursion
        getc(true); // skip ')'
      }
      last = new GameLogNode(entry, last, null, alt);
      node = node || last;
    }
    return node;
  };
  return parse();
};

//
// GameLog

function GameLog(nodes) {
  nodes = nodes || null;
  var current = null;

  // private functions

  var makeMainBranch = function(node) {
    while (node) {
      if (node.alt()) {
        var prev = node.prev();
        prev.set_altnext(node.altnext());
        node.set_altnext(prev);
        node.set_prev(prev.prev());
        prev.set_prev(node);
        if (node.prev()) {
          if (node.prev().next() == prev) {
            node.prev().set_next(node);
          } else {
            node.prev().set_altnext(node);
          }
        } else {
          nodes = node;
        }
      }
      node = node.prev();
    }
  };

  // getters

  this.position = function() {
    var i = 0;
    for (var node = current; node; node = node.prev())
      i += node.alt() ? 0 : 1;
    return i;
  };
  this.treePosition = function() {
    var a = [];
    var node = current;
    while (node) {
      a.push(0);
      while (node && node.prev() && !node.alt()) {
        a.push(a.pop() + 1);
        node = node.prev();
      }
      node = node.prev();
    }
    return a.reverse();
  };
  this.set_treePosition = function(target) {
    current = null;
    for (var i = 0; i < target.length; i++) {
      current = current && current.altnext() || nodes;
      var n = parseInt(target[i]);
      for (var j = 0; j < n; j++)
        current = current && current.next();
    }
  };
  this.size = function() {
    var n = this.position();
    for (var node = current; node && node.next(); node = node.next())
      ++n;
    return n;
  };
  this.current = function() { return current; };
  this.altPrev = function() { return current && current.alt() && current.prev() || current; };
  this.altNext = function() { return current && current.altnext() || current; };
  this.next = function() { return current && current.next() ? current.next() : (current || nodes); };
  this.prev = function() {
    var node = current;
    while (node && node.alt())
      node = node.prev();
    return node && node.prev();
  };
  this.entry = function() { return current && current.entry(); };

  // public methods

  this.addFollowUp = function(type, pos) {
    if (current)
      current.entry().addFollowUp(new FollowUp(type, pos));
  };

  this.toPrev = function() {
    current = this.prev();
  };

  this.toNext = function() {
    current = this.next();
  };

  this.toFirst = function() {
    current = null;
  };

  this.toLast = function() {
    current = current || nodes;
    while (current && current.next())
      current = current.next();
  };

  this.toAltPrev = function() {
    current = this.altPrev();
  };

  this.toAltNext = function() {
    current = this.altNext();
  };

  this.revert = function() {
    if (current) {
      prev = current.prev();
      if (prev && prev.next() == current) {
        prev.set_next(current.altnext());
        if (current.altnext())
          current.altnext().set_prev(prev);
      } else if (prev && prev.altnext() == current) {
        prev.set_altnext(current.altnext());
        if (current.altnext())
          current.altnext().set_prev(prev);
      }
      current = prev;
    }
    if (!current)
      nodes = null;
  };

  this.add = function(entry) {
    for (var node = current && current.next() || nodes; node; node = node.altnext()) {
      if (node.entry().eq(entry)) {
        makeMainBranch(current = node);
        return;
      }
    }
    makeMainBranch(current = new GameLogNode(entry, current, null, current && current.next()));
    nodes = nodes || current;
  };

  this.applyTo = function(target, entryAction) {
    var node = null, prevnode = null;
    for (var i = 0; i < target.length; i++) {
      node = node && node.altnext() || nodes;
      var n = parseInt(target[i]);
      for (var j = 0; j < n; j++) {
        if (node)
          entryAction(node.entry(), prevnode && prevnode.entry());
        prevnode = node;
        node = node && node.next();
      }
    }
    if (node)
      entryAction(node.entry(), prevnode && prevnode.entry());
  };

  this.clone = function() {
    return GameLog.parse(this.toString());
  };

  this.toString = function() {
    return this.treePosition().join('.') + (nodes ? nodes.toString() : '');
  };

  this.toSgf = function(full) {
    return nodes ? nodes.toSgf(full ? null : this.treePosition()) : '';
  };
}

// static methods

GameLog.parse = function(s) {
  var pos = 0;
  while (pos < s.length && '0123456789.'.indexOf(s.charAt(pos)) >= 0)
    ++pos;
  var log = new GameLog(GameLogNode.parse(s.slice(pos)));
  log.set_treePosition(s.slice(0, pos).split('.'));
  return log;
};


//
// Game Board Section
//

//
// SortedSet

function SortedSet(comparator) {
  var data = [];

  var findPosition = function(item) {
    var a = 0, z = data.length;
    while (a < z) {
      var m = Math.floor((a + z) / 2);
      var c = comparator(item, data[m]);
      if (c == 0)
        return m;
      if (c < 0) {
        z = m;
      } else {
        a = m + 1;
      }
    }
    return z;
  };

  var isAt = function(item, i) {
    return i >= 0 && i < data.length && comparator(item, data[i]) == 0;
  };

  // getters

  this.size = function() { return data.length; };
  this.last = function() { return data[data.length - 1]; };
  this.pop = function() { return data.pop(); };

  // public methods

  this.contains = function(item) {
    return isAt(item, findPosition(item));
  };

  this.insert = function(item) {
    var i = findPosition(item);
    if (!isAt(item, i))
      data.splice(i, 0, item);
  };

  this.toArray = function() {
    var array = [];
    for (var i in data)
      array.push(data[i]);
    return array;
  };

  this.toString = function() {
    var s = '';
    for (var i in data)
      s += (s == '' ? '' : ' ') + data[i].toString();
    return s;
  };
}

//
// Field

function Field(pos, type) {
  this.i = pos.i;
  this.j = pos.j;
  this.type = type;

  this.toString = function() {
    return '(' + (this.i + 1) + ' ' + (this.j + 1) + (type ? ' ' + 'OXox+-.'.charAt(type - 1) : '') + ')';
  };
}

Field.comparator = function(field1, field2) {
  if (field1.i < field2.i)
    return -1;
  if (field1.i > field2.i)
    return 1;
  if (field1.j < field2.j)
    return -1;
  if (field1.j > field2.j)
    return 1;
  return 0;
};

// empty field is null
Field.BLACK = 1;
Field.WHITE = 2;
Field.BLACK_DEAD = 3;
Field.WHITE_DEAD = 4;
Field.BLACK_TERRITORY = 5;
Field.WHITE_TERRITORY = 6;
Field.NEUTRAL = 7;

//
// FieldSet

function FieldSet() {
  var fields = new SortedSet(Field.comparator);
  // getters
  this.size = function() { return fields.size(); };
  this.last = function() { return fields.last(); };
  // public methods
  this.pop = function() { return fields.pop(); };
  this.contains = function(item) { return fields.contains(item); };
  this.insert = function(item) { fields.insert(item); };
  this.toArray = function() { return fields.toArray(); };
  this.toString = function() { return fields.toString(); };
}

//
// Board

function Board(size, komi, log) {
  komi = komi >= 0 ? komi : 6.5;
  log = log || new GameLog();
  var board = [];
  var prisonerCounts = {};
  var territoryCounts = {};
  var player = Players.BLACK;
  var ko = null;
  var counting = false;
  var posList = [];

  var reset = function() {
    board = [];
    prisonerCounts[Players.BLACK] = 0;
    prisonerCounts[Players.WHITE] = 0;
    territoryCounts[Players.BLACK] = 0;
    territoryCounts[Players.WHITE] = 0;
    player = Players.BLACK;
    ko = null;
    counting = false;
  };

  var getFieldType = function(pos) {
    return board[pos.i * size + pos.j];
  };

  var setFieldType = function(pos, field) {
    board[pos.i * size + pos.j] = field;
  };

  var otherPlayer = function(player) {
    if (player == Players.BLACK)
      return Players.WHITE;
    if (player == Players.WHITE)
      return Players.BLACK;
    return player;
  };

  var playerToType = function(player) {
    if (player == Players.BLACK)
      return Field.BLACK;
    if (player == Players.WHITE)
      return Field.WHITE;
    return null;
  };

  var typeToPlayer = function(type) {
    if (type == Field.BLACK || type == Field.BLACK_DEAD || type == Field.BLACK_TERRITORY)
      return Players.BLACK;
    if (type == Field.WHITE || type == Field.WHITE_DEAD || type == Field.WHITE_TERRITORY)
      return Players.WHITE;
    return Players.NONE;
  };

  var revert = function() {
    log.revert();
    applyLog();
  };

  var isKo = function(pos) {
    return ko && ko.i == pos.i && ko.j == pos.j;
  };

  var startCounting = function() {
    counting = true;
    player = Players.BOTH;
    for (var i in posList)
      if (!getFieldType(posList[i]))
        makeTerritory(posList[i]);
  };

  var killWorm = function(pos) {
    log.add(new LogEntry(LogEntry.MARK, pos, Players.BOTH));
    processWorm(getWormStones(pos), killStone);
    makeTerritory(pos);
  };

  var resurectWorm = function(pos) {
    log.add(new LogEntry(LogEntry.MARK, pos, Players.BOTH));
    var fields = getTerritory(pos).fields;
    processWorm(getWormStones(pos), resurectStone);
    var restoreFields = new FieldSet();
    while (fields.size() > 0) {
      var field = fields.pop();
      if (field.type != Field.BLACK_DEAD && field.type != Field.WHITE_DEAD && !restoreFields.contains(field)) {
        var territory = getTerritory(field);
        while (territory.fields.size() > 0) {
          var restoreField = territory.fields.pop();
          if (restoreField.type != Field.BLACK_DEAD && restoreField.type != Field.WHITE_DEAD) {
            restoreField.type = territory.type;
            restoreFields.insert(restoreField);
          }
        }
      }
    }
    while (restoreFields.size() > 0) {
      var field = restoreFields.pop();
      setTerritoryField(field, field.type);
    }
  };

  var processWorm = function(stones, stoneAction) {
    while (stones.size() > 0)
      stoneAction(stones.pop());
  };

  var clearTerritory = function(pos) {
    var territory = getTerritoryBorder(pos);
    while (territory.border.size() > 0) {
      var type = territory.border.pop().type;
      if (type == Field.BLACK_DEAD || type == Field.WHITE_DEAD) {
        callbackError('Dead stone inside');
        return;
      }
    }
    log.add(new LogEntry(LogEntry.MARK, pos, Players.BOTH));
    fillTerritory(territory.fields, Field.NEUTRAL);
  };

  var setTerritory = function(pos) {
    var territory = getTerritory(pos);
    if (territory.type == Field.NEUTRAL) {
      callbackError('Not a single-color border');
      return;
    }
    log.add(new LogEntry(LogEntry.MARK, pos, Players.BOTH));
    fillTerritory(territory.fields, territory.type);
  };

  var makeTerritory = function(pos) {
    var territory = getTerritory(pos);
    fillTerritory(territory.fields, territory.type);
  };

  var fillTerritory = function(fields, type) {
    while (fields.size() > 0)
      setTerritoryField(fields.pop(), type);
  };

  var getWormStones = function(pos) {
    var stones = new FieldSet();
    var posFieldType = getFieldType(pos);
    if (posFieldType && posFieldType != Field.NEUTRAL && posFieldType != Field.BLACK_TERRITORY && posFieldType != Field.WHITE_TERRITORY)
      processArea(new Field(pos, posFieldType), stones, function(field) { return field.type == posFieldType; });
    return stones;
  };

  var getLiberties = function(stones) {
    var liberties = new FieldSet();
    var fields = stones.toArray(); // do not destruct stones
    for (var i in fields) {
      var neighbors = getNeighbors(fields[i]);
      while (neighbors.size() > 0) {
        var field = neighbors.pop();
        if (!field.type && !liberties.contains(field))
          liberties.insert(field);
      }
    }
    return liberties.size();
  };

  var getTerritoryBorder = function(pos) {
    var territory = new FieldSet();
    var border = new FieldSet();
    var posFieldType = getFieldType(pos);
    if (!posFieldType || posFieldType == Field.NEUTRAL || posFieldType == Field.BLACK_TERRITORY || posFieldType == Field.WHITE_TERRITORY)
      processArea(new Field(pos, posFieldType), territory, function(field) {
        if (field.type == posFieldType)
          return true;
        if (!border.contains(field))
          border.insert(field);
        return false;
      });
    return { fields: territory, border: border };
  };

  // get max. contiguous 4-connected area containing 'pos' surrounded by living stones
  var getTerritory = function(pos) {
    var type = null;
    var territory = new FieldSet();
    var posFieldType = getFieldType(pos);
    if (posFieldType != Field.BLACK && posFieldType != Field.WHITE)
      processArea(new Field(pos, posFieldType), territory, function(field) {
        if (field.type == Field.BLACK) {
          type = !type ? Field.BLACK_TERRITORY : (type == Field.WHITE_TERRITORY ? Field.NEUTRAL : type);
          return false;
        }
        if (field.type == Field.WHITE) {
          type = !type ? Field.WHITE_TERRITORY : (type == Field.BLACK_TERRITORY ? Field.NEUTRAL : type);
          return false;
        }
        return true;
      });
    return { type: type || Field.NEUTRAL, fields: territory };
  };

  var processArea = function(seedField, areaFields, fieldAction) {
    var fieldQueue = new FieldSet();
    fieldQueue.insert(seedField);
    while (fieldQueue.size() > 0) {
      var field = fieldQueue.pop();
      var neighbors = getNeighbors(field);
      while (neighbors.size() > 0) {
        var newField = neighbors.pop();
        if (fieldAction(newField) && !areaFields.contains(newField))
          fieldQueue.insert(newField);
      }
      areaFields.insert(field);
    }
  };

  var getNeighbors = function(pos) {
    var fields = new FieldSet();
    if (pos.i > 0)
      fields.insert(new Field({ i: pos.i - 1, j: pos.j }, getFieldType({ i: pos.i - 1, j: pos.j })));
    if (pos.i < size - 1)
      fields.insert(new Field({ i: pos.i + 1, j: pos.j }, getFieldType({ i: pos.i + 1, j: pos.j })));
    if (pos.j > 0)
      fields.insert(new Field({ i: pos.i, j: pos.j - 1 }, getFieldType({ i: pos.i, j: pos.j - 1 })));
    if (pos.j < size - 1)
      fields.insert(new Field({ i: pos.i, j: pos.j + 1 }, getFieldType({ i: pos.i, j: pos.j + 1 })));
    return fields;
  };

  var addFollowUp = function(type, pos) {
    log.addFollowUp(type, pos);
  };

  var applyLog = function() {
    reset();
    var target = log.treePosition();
    log.applyTo(target, function(entry, preventry) {
      ko = null;
      if (entry.type == LogEntry.PASS) {
        if (preventry && preventry.type == LogEntry.PASS)
          counting = true;
      } else if (entry.type == LogEntry.PUT) {
        setFieldType(entry, playerToType(entry.player));
      }
      for (var k in entry.followUps) {
        var followUp = entry.followUps[k];
        if (followUp.type == FollowUp.KO) {
          ko = { i: followUp.i, j: followUp.j };
        } else if (followUp.type == FollowUp.CAPTURE) {
          captureStone(followUp, true);
        } else if (followUp.type == FollowUp.MARK_AS_DEAD) {
          killStone(followUp, true);
        } else if (followUp.type == FollowUp.MARK_AS_LIVING) {
          resurectStone(followUp, true);
        } else if (followUp.type == FollowUp.MARK_AS_NEUTRAL) {
          setTerritoryField(followUp, Field.NEUTRAL, true);
        } else if (followUp.type == FollowUp.MARK_AS_BLACK) {
          setTerritoryField(followUp, Field.BLACK, true);
        } else if (followUp.type == FollowUp.MARK_AS_WHITE) {
          setTerritoryField(followUp, Field.WHITE, true);
        }
      }
      player = counting ? Players.BOTH : otherPlayer(entry.player);
    });
  };

  var captureStone = function(pos, fromlog) {
    var type = getFieldType(pos);
    setFieldType(pos, null);
    if (!fromlog)
      addFollowUp(FollowUp.CAPTURE, pos);
    prisonerCounts[typeToPlayer(type)]++;
  };

  var killStone = function(pos, fromlog) {
    var type = getFieldType(pos);
    setFieldType(pos, type == Field.BLACK ? Field.BLACK_DEAD : Field.WHITE_DEAD);
    if (!fromlog)
      addFollowUp(FollowUp.MARK_AS_DEAD, pos);
    territoryCounts[otherPlayer(typeToPlayer(type))]++;
    prisonerCounts[typeToPlayer(type)]++;
  };

  var resurectStone = function(pos, fromlog) {
    var type = getFieldType(pos);
    if (type == Field.BLACK_DEAD || type == Field.WHITE_DEAD) {
      setFieldType(pos, type == Field.BLACK_DEAD ? Field.BLACK : Field.WHITE);
      if (!fromlog)
        addFollowUp(FollowUp.MARK_AS_LIVING, pos);
      territoryCounts[otherPlayer(typeToPlayer(type))]--;
      prisonerCounts[typeToPlayer(type)]--;
    }
  };

  var setTerritoryField = function(pos, type, fromlog) {
    if (!getFieldType(pos)) {
      updateTerritoryField(pos, Field.NEUTRAL, FollowUp.MARK_AS_NEUTRAL, null, 0, fromlog);
      occupyTerritoryField(pos, type, fromlog);
    } else if (getFieldType(pos) == Field.NEUTRAL) {
      occupyTerritoryField(pos, type, fromlog);
    } else if (getFieldType(pos) == Field.BLACK_TERRITORY) {
      if (typeToPlayer(type) != Players.BLACK) {
        updateTerritoryField(pos, Field.NEUTRAL, FollowUp.MARK_AS_NEUTRAL, Players.BLACK, -1, fromlog);
        occupyTerritoryField(pos, type, fromlog);
      }
    } else if (getFieldType(pos) == Field.WHITE_TERRITORY) {
      if (typeToPlayer(type) != Players.WHITE) {
        updateTerritoryField(pos, Field.NEUTRAL, FollowUp.MARK_AS_NEUTRAL, Players.WHITE, -1, fromlog);
        occupyTerritoryField(pos, type, fromlog);
      }
    }
  };

  var occupyTerritoryField = function(pos, type, fromlog) {
    if (typeToPlayer(type) == Players.BLACK) {
      updateTerritoryField(pos, Field.BLACK_TERRITORY, FollowUp.MARK_AS_BLACK, Players.BLACK, 1, fromlog);
    } else if (typeToPlayer(type) == Players.WHITE) {
      updateTerritoryField(pos, Field.WHITE_TERRITORY, FollowUp.MARK_AS_WHITE, Players.WHITE, 1, fromlog);
    }
  };

  var updateTerritoryField = function(pos, fieldType, followUp, player, delta, fromlog) {
    setFieldType(pos, fieldType);
    if (!fromlog)
      addFollowUp(followUp, pos);
    if (delta != 0)
      territoryCounts[player] += delta;
  };

  // event callbacks

  var callbackError = function(s) { alert(s); };
  this.setErrorCallback = function(callback) { callbackError = callback; };

  // getters / setters

  this.size = function() { return size; };
  this.komi = function() { return komi; };
  this.set_komi = function(newKomi) { komi = newKomi; };
  this.counting = function() { return counting; }
  this.currentPlayer = function() { return player; };
  this.blackPrisoners = function() { return prisonerCounts[Players.BLACK]; };
  this.whitePrisoners = function() { return prisonerCounts[Players.WHITE]; };
  this.blackArea = function() { return territoryCounts[Players.BLACK]; };
  this.whiteArea = function() { return territoryCounts[Players.WHITE]; };
  this.moveCount = function() { return log.position(); };
  this.totalMoveCount = function() { return log.size(); };
  this.hasPrev = function() { return log != null && log.prev() != log.current(); };
  this.hasNext = function() { return log != null && log.next() != log.current(); };
  this.hasAltPrev = function() { return log != null && log.altPrev() != log.current(); };
  this.hasAltNext = function() { return log != null && log.altNext() != log.current(); };

  // public methods

  this.getFieldType = getFieldType;

  this.revert = revert;

  this.isLast = function(pos) {
    var last = log.entry();
    return last && last.type == LogEntry.PUT && last.i == pos.i && last.j == pos.j;
  };

  this.isKo = isKo;

  this.lastMove = function() {
    var last = log && log.entry()
    return last ? { type: last.type, player: last.player } : null;
  };

  this.toPrev = function() {
    log.toPrev();
    applyLog();
  };

  this.toNext = function() {
    log.toNext();
    applyLog();
  };

  this.toFirst = function() {
    log.toFirst();
    reset();
  };

  this.toLast = function() {
    log.toLast();
    applyLog();
  };

  this.toAltPrev = function() {
    log.toAltPrev();
    applyLog();
  };

  this.toAltNext = function() {
    log.toAltNext();
    applyLog();
  };

  this.play = function() {
    if (!counting)
      return;
    while (log.entry() && log.entry().type == LogEntry.MARK)
      log.revert();
    while (log.entry() && log.entry().type == LogEntry.PASS)
      log.revert();
    applyLog();
  };

  this.pass = function() {
    if (counting)
      return;
    ko = null;
    var score = log.entry() && log.entry().type == LogEntry.PASS;
    log.add(new LogEntry(LogEntry.PASS, { i: 0, j: 0 }, player));
    player = otherPlayer(player);
    if (score)
      startCounting();
  };

  this.onClick = function(pos) {
    if (!counting) {
      this.makeMove(pos);
    } else {
      var type = getFieldType(pos);
      if (type == Field.BLACK || type == Field.WHITE) {
        killWorm(pos);
      } else if (type == Field.BLACK_DEAD || type == Field.WHITE_DEAD) {
        resurectWorm(pos);
      } else if (type == Field.BLACK_TERRITORY || type == Field.WHITE_TERRITORY) {
        clearTerritory(pos);
      } else if (type == Field.NEUTRAL) {
        setTerritory(pos);
      }
    }
  };

  this.makeMove = function(pos) {
    if (getFieldType(pos) || isKo(pos)) {
      callbackError('Illegal move at [' + (pos.i + 1) + ', ' + (pos.j + 1) + ']' + (isKo(pos) ? ' (ko)' : ''));
      return;
    }
    ko = null;
    var type = playerToType(player);
    setFieldType(pos, type);
    log.add(new LogEntry(LogEntry.PUT, pos, player));
    player = otherPlayer(player);
    var koWannabe = null;
    var prisonerCount = 0;
    var neighbors = getNeighbors(pos);
    while (neighbors.size() > 0) {
      var neighbor = neighbors.pop();
      if (neighbor.type != type) {
        var stones = getWormStones(neighbor);
        if (stones.size() > 0 && getLiberties(stones) == 0) {
          prisonerCount += stones.size();
          if (stones.size() == 1 && prisonerCount == 1)
            koWannabe = { i: stones.last().i, j: stones.last().j };
          processWorm(stones, captureStone);
        }
      }
    }
    if (prisonerCount == 0) {
      if (getLiberties(getWormStones(pos)) == 0) {
        revert();
        callbackError('Suicide attempt');
      }
    } else if (prisonerCount == 1) {
      var stones = getWormStones(pos);
      if (stones.size() == 1 && getLiberties(stones) == 1) {
        ko = koWannabe;
        addFollowUp(FollowUp.KO, ko);
      }
    }
  };

  this.clone = function() {
    var board = new Board(size, komi, log.clone());
    board.setErrorCallback(callbackError);
    return board;
  };

  this.eq = function(board) {
    if (!board)
      return false;
    for (var i in posList)
      if (!board.eqField(posList[i], getFieldType(posList[i])))
        return false;
    return true;
  };

  this.eqField = function(pos, type) {
    return type == getFieldType(pos);
  };

  this.toString = function() {
    return wave.util.printJson({ size: size, komi: komi, log: log.toString() });
  };

  this.printSgf = function(names, full) {
    var codes = 'abcdefghijklmnopqrstuvwxy';
    var now = new Date();
    var month = (now.getMonth() < 9 ? '0' : '') + (now.getMonth() + 1);
    var day = (now.getDate() < 10 ? '0' : '') + now.getDate();
    var hour = (now.getHours() < 10 ? '0' : '') + now.getHours();
    var minute = (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
    var leadNode = ';GM[1]FF[4]RU[Japanese]';
    leadNode += 'SZ[' + size + ']\nPB[' + names.black + ']\nPW[' + names.white + ']\nKM[' + komi + ']\n';
    leadNode +='DT[' + now.getFullYear() + '-' + month + '-' + day + ']TM[' + hour + minute + ']';
    return '(' + leadNode + log.toSgf(full) + ')';
  };

  // initialization

  for (var i = 0; i < size; i++)
    for (var j = 0; j < size; j++)
      posList.push({ i: i, j: j });
  applyLog();
}

// static functions

Board.parse = function(s) {
  var o = eval('(' + s + ')');
  return new Board(o.size, o.komi, GameLog.parse(o.log));
};

Board.parseSgf = function(s, error) {
  error = error || function(s) { alert(s); };

  var skipWS = function() {
    while (s.length > 0 && s.charCodeAt(0) <= 32)
      s = s.slice(1);
  };

  var see = function(r) {
    skipWS();
    return s.length >= r.length && s.substring(0, r.length) == r;
  };

  var match = function(r) {
    if (!see(r)) {
      error('Expected "' + r + '"');
      return false;
    }
    s = s.slice(r.length);
    return true;
  };

  var seeName = function() {
    skipWS();
    return s.length > 0 && 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(s.charAt(0)) >= 0;
  };

  var board = null;
  var mainBranch = true;

  var newTree = function() {
    return true;
  };

  var endTree = function() {
    mainBranch = false;
    return true;
  };

  var newNode = function() {
    return true;
  };

  var endNode = function() {
    return true;
  };

  var propertyName = '';

  var newProperty = function(name) {
    propertyName = name;
    return name != '';
  };

  var errorDetected = false; // callback-set board error

  var endProperty = function(values) {
    if (!mainBranch) // ignoring alternative branches for now
      return true;
    errorDetected = false;
    if (propertyName == 'SZ') { // board size
      var size = parseInt(values[0]);
      if (size > 0 && size <= 19) {
        board = new Board(size);
        board.setErrorCallback(function(message) { error(message); errorDetected = true; });
      }
    } else if (propertyName == 'KM') { // komi
      var komi = parseFloat(values[0]);
      if (board && !isNaN(komi) && komi >= 0)
        board.set_komi(komi);
    } else if (propertyName == 'B' || propertyName == 'W') { // player's turn
      if (!board) {
        error('Board size not found');
        return false;
      }
      if (propertyName == 'B' && board.currentPlayer() == Players.WHITE || propertyName == 'W' && board.currentPlayer() == Players.BLACK) {
        error('The player\'s turn not expected');
        return false;
      }
      if (values[0].length != 2 && values[0] != '') {
        error('Invalid property value');
        return false;
      }
      if (values[0] == '' || values[0] == 'tt') {
        if (!board) {
          error('Board size not found');
          return false;
        }
        board.pass();
      } else {
        var pos = { i: values[0].charCodeAt(0) - 97, j: values[0].charCodeAt(1) - 97 };
        if (pos.i < 0 || pos.j < 0 || pos.i >= board.size || pos.j >= board.size) {
          error('Index out of board');
          return false;
        }
        if (!board) {
          error('Board size not found');
          return false;
        }
        board.makeMove(pos);
      }
    }
    return !errorDetected;
  };

  // Value -> '[' regex('[A-Z]+') ']'
  var parseName = function() {
    var r = '';
    while (seeName()) {
      r += s.charAt(0);
      s = s.slice(1);
    }
    if (r == '')
      error('Expected property name');
    return r;
  };

  // Value -> '[' regex('((\\\])|([^\]]))*') ']'
  var parseValue = function() {
    if (!match('['))
      return null;
    var value = '';
    while (s.length > 0 && s.charAt(0) != ']') {
      if (s.charAt(0) == '\\') {
        s = s.slice(1);
        if (s.length > 0 && (s.charAt(0) == '\r' || s.charAt(0) == '\n')) {
          while (s.length > 0 && (s.charAt(0) == '\r' || s.charAt(0) == '\n'))
            s = s.slice(1);
          continue;
        }
      }
      if (s.length > 0) {
        value += s.charAt(0);
        s = s.slice(1);
      }
    }
    return match(']') ? value : null;
  };

  // ValueList -> Value ValueList | end-property empty
  var parseValueList = function(values) {
    if (!see('['))
      return endProperty(values);
    var value = parseValue();
    if (value == null)
      return false;
    values.push(value);
    return parseValueList(values);
  };

  // Property -> Name new-property Value ValueList
  var parseProperty = function() {
    if (!newProperty(parseName()))
      return false;
    var value = parseValue();
    return value != null && parseValueList([ value ]);
  };

  // PropertyList -> Property PropertyList | empty
  var parsePropertyList = function() {
    return !seeName() || parseProperty() && parsePropertyList();
  };

  // Node -> ';' new-node PropertyList end-node
  var parseNode = function() {
    return match(';') && newNode() && parsePropertyList() && endNode();
  };

  // NodeList -> Node NodeList | empty
  var parseNodeList = function() {
    return !see(';') || parseNode() && parseNodeList();
  };

  // Tree -> '(' new-tree Node NodeList TreeList end-tree ')'
  var parseTree = function() {
    return match('(') && newTree() && parseNode() && parseNodeList() && parseTreeList() && endTree() && match(')');
  };

  // TreeList -> Tree TreeList | empty
  var parseTreeList = function() {
    return !see('(') || parseTree() && parseTreeList();
  };

  // S -> Tree
  parseTree();
  return board;
};


//
// Game UI Section
//

//
// Audio

function SoundPlayer(soundFiles) {
  var file = null, altfile = null;
  var audio = new Audio();
  if (!audio)
    return;
  for (var i = 0; i < soundFiles.length && !file; i++) {
    var canPlayType = audio.canPlayType(soundFiles[i].type);
    if (canPlayType == 'probably')
      file = soundFiles[i].file;
    if (!altfile && canPlayType == 'maybe')
      altfile = soundFiles[i].file;
  }
  file = file || altfile;
  audio = null;
  var load = function() {
    if (file && !audio && (audio = new Audio(file)))
      audio.load();
  };

  // public methods

  this.play = function() {
    load();
    if (audio)
      audio.play();
  };

  // initialization

  load();
}

//
// BoardGeometry

function BoardGeometry(x0, dX, y0, dY) {
  this.getXforIndex = function(i) { return i * dX + x0; };
  this.getYforIndex = function(j) { return j * dY + y0; };
  this.getPosition = function(x, y) { return { i: Math.round((x - x0) / dX), j: Math.round((y - y0) / dY) }; };
}

//
// Game

function Game(div, themeUrl) {
  var board = null, tryBoard = null;
  var players = null;
  var boardGeometry = new BoardGeometry(10, 16, 10, 16);
  var stoneGeometry = { width: 20, height: 20 };
  var boardImageUrls = [];
  boardImageUrls[9] = themeUrl + 'board-9.png';
  boardImageUrls[13] = themeUrl + 'board-13.png';
  boardImageUrls[19] = themeUrl + 'board-19.png';
  var sound = new SoundPlayer([
    { type: 'audio/mp3', file: themeUrl + 'audio/ping.mp3' },
    { type: 'audio/ogg', file: themeUrl + 'audio/ping.ogg' },
    { type: 'audio/wma', file: themeUrl + 'audio/ping.wma' },
    { type: 'audio/wav', file: themeUrl + 'audio/ping.wav' },
  ]);
  var boardImage = null;
  var fieldImages = [];

  var newBoard = function(sourceBoard, parsed) {
    board = sourceBoard || new Board(19);
    board.setErrorCallback(callbackError);
    tryBoard = null;
    if (!players)
      players = new Players();
    setupBoardUI(parsed);
    renderBoard(board);
    submitWaveState(parsed);
  };

  var boardMove = function(boardAction) {
    if (canPlay() && !tryBoard) {
      boardAction(true);
      submitWaveState();
    } else if (tryBoard) {
      boardAction(false);
      renderBoard(tryBoard);
      setUIState(false);
    }
  };

  var renderBoard = function(board) {
    for (var i = 0 ; i < board.size(); i++)
      for (var j = 0; j < board.size(); j++)
        setBoardField(board, { i: i, j: j });
  };

  var setBoardField = function(board, pos) {
    var type = board.getFieldType(pos);
    var field = fieldImages[pos.i * board.size() + pos.j];
    if (!type) {
      field.className = board.isKo(pos) ? 'fieldKo' : 'fieldEmpty';
    } else if (type == Field.BLACK) {
      field.className = board.isLast(pos) ? 'fieldBlast' : 'fieldB';
    } else if (type == Field.WHITE) {
      field.className = board.isLast(pos) ? 'fieldWlast' : 'fieldW';
    } else if (type == Field.BLACK_DEAD) {
      field.className = 'fieldBdead';
    } else if (type == Field.WHITE_DEAD) {
      field.className = 'fieldWdead';
    } else if (type == Field.BLACK_TERRITORY) {
      field.className = 'fieldBterr';
    } else if (type == Field.WHITE_TERRITORY) {
      field.className = 'fieldWterr';
    } else if (type == Field.NEUTRAL) {
      field.className = 'fieldNeutral';
    } else {
      field.className = 'fieldEmpty';
    }
  };

  var setUIState = function(busy, parsed) {
    var b = tryBoard || board;
    if (!b) {
      var disabledNavButStates = [false, false, false, false, false, false];
      callbackBoardUpdate(busy, boardImage ? boardImage.width : 0, null, null, 'Initializing...', false, disabledNavButStates);
      return;
    }
    var c = b.moveCount();
    var t = b.totalMoveCount();
    var info = t == 0 ? 'New game, komi = ' + b.komi() : 'Move ' + c + (c != t ? ' / ' + t : '');
    if (b.blackPrisoners() > 0 || b.whitePrisoners() > 0)
      info += ', B-' + b.blackPrisoners() + ' W-' + b.whitePrisoners();
    var size = boardImage ? boardImage.width : 0;
    var navButStates = [b.hasPrev(), b.hasPrev(), b.hasNext(), b.hasAltNext(), b.hasAltPrev(), b.hasNext()];
    callbackBoardUpdate(busy, size, b.currentPlayer(), b.lastMove(), info, parsed, navButStates);
  };

  var submitWaveState = function(parsed) {
    var waveState = wave.getState();
    if (!waveState)
      return;
    var delta = {};
    var change = false;
    if (board) {
      var newBoardString = board.toString();
      if (newBoardString != waveState.get('board')) {
        delta['board'] = newBoardString;
        change = true;
      }
    }
    if (players) {
      var newPlayersString = players.toString();
      if (newPlayersString != waveState.get('players')) {
        delta['players'] = newPlayersString;
        change = true;
      }
    }
    if (change) {
      waveState.submitDelta(delta);
      setUIState(true, parsed);
    }
  };

  var onClick = function(pos) {
    if (!board || pos.i < 0 || pos.j < 0 || pos.i >= board.size() || pos.j >= board.size())
      return;
    if (!canPlay()) {
      callbackError('Not your turn');
      return;
    }
    if (tried()) {
      callbackError("Submit or take back your try first");
      return;
    }
    if (tryBoard) {
      tryBoard.onClick(pos);
      if (tried()) {
        renderBoard(tryBoard);
        setUIState(false);
      }
      return;
    }
    board.onClick(pos);
    submitWaveState();
  };

  var onClickBoard = function(event) {
    if (event.offsetX && event.offsetY) {
      onClick(boardGeometry.getPosition(event.offsetX, event.offsetY));
      return;
    }
    var offsetLeft = 0;
    var offsetTop = 0;
    for (var obj = boardImage; obj.offsetParent; obj = obj.offsetParent) {
      offsetLeft += obj.offsetLeft;
      offsetTop += obj.offsetTop;
    }
    onClick(boardGeometry.getPosition(event.pageX - offsetLeft, event.pageY - offsetTop));
  };

  var setupBoardUI = function(parsed) {
    setUIState(true, parsed);
    for (var i = 0; i < fieldImages.length; i++)
      div.removeChild(fieldImages[i]);
    if (boardImage)
      div.removeChild(boardImage);
    boardImage = document.createElement('img');
    boardImage.onload = function() { setUIState(false, parsed); };
    boardImage.src = boardImageUrls[board.size()];
    boardImage.onclick = function(e) { onClickBoard(e); }
    div.appendChild(boardImage);
    fieldImages = [];
    for (var i = 0; i < board.size(); i++) {
      for (var j = 0; j < board.size(); j++) {
        var field = document.createElement('div');
        field.className = 'fieldEmpty';
        field.style.left = Math.round(boardGeometry.getXforIndex(i) - stoneGeometry.width / 2) + 'px';
        field.style.top = Math.round(boardGeometry.getYforIndex(j) - stoneGeometry.height / 2) + 'px';
        field.onclick = (function(i, j) { return function(e) { onClick({ i: i, j: j }); }; })(i, j); // closure for own i, j copy
        fieldImages[i * board.size() + j] = field;
        div.appendChild(field);
      }
    }
  };

  var restorePlayers = function(playersString) {
    if (playersString) {
      tryBoard = null;
      players = Players.parse(playersString);
      callbackPlayersUpdate(players);
    }
  };

  var restoreGameBoard = function(gameBoardString) {
    if (!board) {
      if (!gameBoardString) {
        newBoard();
      } else {
        board = Board.parse(gameBoardString);
        board.setErrorCallback(callbackError);
        tryBoard = null;
        setupBoardUI();
      }
      return true;
    }
    if (gameBoardString && board.toString() != gameBoardString) {
      var oldSize  = board.size();
      board = Board.parse(gameBoardString);
      board.setErrorCallback(callbackError);
      tryBoard = null;
      if (oldSize != board.size()) {
        setupBoardUI();
      } else if (board.moveCount() > 0 && board.moveCount() == board.totalMoveCount()) {
        sound.play();
      }
      return true;
    }
    return false;
  };

  // event callbacks

  var callbackBoardUpdate = function() {};
  this.setBoardUpdateCallback = function(callback) { callbackBoardUpdate = callback; };
  var callbackPlayersUpdate = function() {};
  this.setPlayersUpdateCallback = function(callback) { callbackPlayersUpdate = callback; };
  var callbackError = function(s) { alert(s); };
  this.setErrorCallback = function(callback) { callbackError = callback; };

  // getters

  var canPlay = function() { return board && players && (board.counting() || players.hasColor(wave.getViewer().getId(), board.currentPlayer())); };
  this.canPlay = canPlay;
  this.inTryMode = function() { return tryBoard != null; };
  var tried = function() { return board && tryBoard && !board.eq(tryBoard); };
  this.tried = tried;
  this.scoring = function() { return board && board.counting(); };

  // wave event callbacks

  this.onWaveStateChange = function() {
    var waveState = wave.getState();
    restorePlayers(waveState.get('players'));
    var changed = restoreGameBoard(waveState.get('board'));
    renderBoard(board);
    setUIState(false, !changed);
  };

  this.onWaveParticipantChange = function() {
    if (!players)
      players = new Players();
    players.synchronize();
    callbackPlayersUpdate(players);
    submitWaveState();
  };

  // public methods

  this.submitWaveState = submitWaveState;

  this.newGame = function(size, komi) {
    newBoard(new Board(size, komi));
  };

  this.pass = function() {
    if (canPlay()) {
      board.pass();
      tryBoard = null;
      submitWaveState();
    }
  };

  this.undo = function() {
    boardMove(function(submit) { if (submit) { board.toPrev(); } else { tryBoard.toPrev(); } });
  };

  this.redo = function() {
    boardMove(function(submit) { if (submit) { board.toNext(); } else { tryBoard.toNext(); } });
  };

  this.first = function() {
    boardMove(function(submit) { if (submit) { board.toFirst(); } else { tryBoard.toFirst(); } });
  };

  this.last = function() {
    boardMove(function(submit) { if (submit) { board.toLast(); } else { tryBoard.toLast(); } });
  };

  this.up = function() {
    boardMove(function(submit) { if (submit) { board.toAltPrev(); } else { tryBoard.toAltPrev(); } });
  };

  this.down = function() {
    boardMove(function(submit) { if (submit) { board.toAltNext(); } else { tryBoard.toAltNext(); } });
  };

  this.tryMode = function() {
    if (canPlay()) {
      tryBoard = board.clone();
      renderBoard(tryBoard);
      setUIState(false);
    }
  };

  this.submitTry = function() {
    if (tried()) {
      board = tryBoard;
      tryBoard = null;
      submitWaveState();
    }
  };

  this.play = function() {
    if (board) {
      board.play();
      submitWaveState();
    }
  };

  this.result = function() {
    if (!board)
      return '*nothing*';
    var bt = board.blackArea(), bp = board.whitePrisoners();
    var wt = board.whiteArea(), wp = board.blackPrisoners();
    var br = bt + bp;
    var wr = wt + wp + board.komi();
    return 'Black: ' + br + ' (' + bt + ' + ' + bp + ')\r\nWhite: ' + wr + ' (' + wt + ' + ' + wp + ' + ' + board.komi() + ')\r\n\r\n' + (br >= wr ? 'Black winning by ' + (br - wr) : 'White winning by ' + (wr - br)) + ' points';
  };

  this.smallResult = function() {
    if (!board)
      return '';
    var br = board.blackArea() + board.whitePrisoners();
    var wr = board.whiteArea() + board.blackPrisoners() + board.komi();
    return br >= wr ? 'B+' + (br - wr) : 'W+' + (wr - br);
  };

  this.exportSgf = function(full) {
    return !board || !players ? '*nothing*' : board.printSgf(players.getNames(), full);
  };

  this.importSgf = function(s) {
    var board = Board.parseSgf(s, callbackError);
    if (board)
      newBoard(board, true);
  };

  // initialization

  setUIState(true);
}
