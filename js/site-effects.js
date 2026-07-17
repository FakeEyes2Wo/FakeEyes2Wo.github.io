(function () {
  'use strict';

  var activeController = null;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function ParticleField(canvas, host) {
    this.canvas = canvas;
    this.host = host;
    this.context = canvas.getContext('2d');
    this.particles = [];
    this.width = 0;
    this.height = 0;
    this.frame = null;
    this.visible = true;
    this.pointer = { x: 0, y: 0, active: false };
    this.palette = [
      [103, 232, 249],
      [167, 139, 250],
      [148, 163, 184]
    ];

    this.onResize = this.resize.bind(this);
    this.onPointerMove = this.handlePointerMove.bind(this);
    this.onPointerLeave = this.handlePointerLeave.bind(this);
    this.onVisibilityChange = this.handleVisibilityChange.bind(this);
    this.tick = this.tick.bind(this);

    this.resizeObserver = null;
    this.intersectionObserver = null;
  }

  ParticleField.prototype.init = function () {
    if (!this.context) return;

    this.resize();
    this.host.addEventListener('pointermove', this.onPointerMove, { passive: true });
    this.host.addEventListener('pointerleave', this.onPointerLeave, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(this.onResize);
      this.resizeObserver.observe(this.host);
    } else {
      window.addEventListener('resize', this.onResize, { passive: true });
    }

    if ('IntersectionObserver' in window) {
      var self = this;
      this.intersectionObserver = new IntersectionObserver(function (entries) {
        self.visible = Boolean(entries[0] && entries[0].isIntersecting);
        if (self.visible) self.start();
        else self.stop();
      }, { rootMargin: '120px 0px' });
      this.intersectionObserver.observe(this.host);
    }

    if (reduceMotion.matches) this.draw(false);
    else this.start();
  };

  ParticleField.prototype.resize = function () {
    var rect = this.host.getBoundingClientRect();
    var width = Math.max(1, Math.round(rect.width));
    var height = Math.max(1, Math.round(rect.height));
    var dpr = Math.min(window.devicePixelRatio || 1, 1.75);

    if (width === this.width && height === this.height) return;

    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);

    var density = window.innerWidth < 768 ? 52000 : 34000;
    var count = clamp(Math.round((width * height) / density), 8, 28);
    this.particles = [];

    for (var i = 0; i < count; i += 1) {
      this.particles.push(this.createParticle());
    }

    this.draw(false);
  };

  ParticleField.prototype.createParticle = function () {
    var color = this.palette[Math.floor(Math.random() * this.palette.length)];
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      radius: Math.random() * 1.15 + 0.45,
      alpha: Math.random() * 0.46 + 0.2,
      color: color
    };
  };

  ParticleField.prototype.handlePointerMove = function (event) {
    var rect = this.host.getBoundingClientRect();
    this.pointer.x = event.clientX - rect.left;
    this.pointer.y = event.clientY - rect.top;
    this.pointer.active = true;
  };

  ParticleField.prototype.handlePointerLeave = function () {
    this.pointer.active = false;
  };

  ParticleField.prototype.handleVisibilityChange = function () {
    if (document.hidden) this.stop();
    else if (this.visible) this.start();
  };

  ParticleField.prototype.start = function () {
    if (reduceMotion.matches || document.hidden || !this.visible || this.frame !== null) return;
    this.frame = window.requestAnimationFrame(this.tick);
  };

  ParticleField.prototype.stop = function () {
    if (this.frame !== null) {
      window.cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  };

  ParticleField.prototype.tick = function () {
    this.frame = null;
    if (document.hidden || !this.visible || reduceMotion.matches) return;
    this.draw(true);
    this.start();
  };

  ParticleField.prototype.draw = function (animate) {
    var context = this.context;
    if (!context || !this.width || !this.height) return;

    context.clearRect(0, 0, this.width, this.height);

    for (var i = 0; i < this.particles.length; i += 1) {
      var particle = this.particles[i];

      if (animate) {
        if (this.pointer.active) {
          var dx = this.pointer.x - particle.x;
          var dy = this.pointer.y - particle.y;
          var distance = Math.sqrt(dx * dx + dy * dy) || 1;

          if (distance < 135) {
            var force = (1 - distance / 135) * 0.018;
            particle.vx -= (dx / distance) * force;
            particle.vy -= (dy / distance) * force;
          }
        }

        particle.vx *= 0.992;
        particle.vy *= 0.992;
        particle.vx = clamp(particle.vx, -0.48, 0.48);
        particle.vy = clamp(particle.vy, -0.48, 0.48);
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < -8) particle.x = this.width + 8;
        if (particle.x > this.width + 8) particle.x = -8;
        if (particle.y < -8) particle.y = this.height + 8;
        if (particle.y > this.height + 8) particle.y = -8;
      }

      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fillStyle = 'rgba(' + particle.color.join(',') + ',' + particle.alpha + ')';
      context.fill();
    }

    var linkDistance = window.innerWidth < 768 ? 72 : 96;
    for (var a = 0; a < this.particles.length; a += 1) {
      for (var b = a + 1; b < this.particles.length; b += 1) {
        var first = this.particles[a];
        var second = this.particles[b];
        var linkX = first.x - second.x;
        var linkY = first.y - second.y;
        var linkLength = Math.sqrt(linkX * linkX + linkY * linkY);

        if (linkLength < linkDistance) {
          var linkAlpha = (1 - linkLength / linkDistance) * 0.07;
          context.beginPath();
          context.moveTo(first.x, first.y);
          context.lineTo(second.x, second.y);
          context.strokeStyle = 'rgba(103,232,249,' + linkAlpha + ')';
          context.lineWidth = 0.65;
          context.stroke();
        }
      }
    }
  };

  ParticleField.prototype.destroy = function () {
    this.stop();
    this.host.removeEventListener('pointermove', this.onPointerMove);
    this.host.removeEventListener('pointerleave', this.onPointerLeave);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);

    if (this.resizeObserver) this.resizeObserver.disconnect();
    else window.removeEventListener('resize', this.onResize);
    if (this.intersectionObserver) this.intersectionObserver.disconnect();
  };

  function initRotatingText(root, cleanups) {
    var target = root.querySelector('[data-rotate]');
    if (!target || reduceMotion.matches) return;

    var words = (target.getAttribute('data-words') || '')
      .split('|')
      .map(function (word) { return word.trim(); })
      .filter(Boolean);

    if (words.length < 2) return;

    var index = 0;
    var timer = window.setInterval(function () {
      target.classList.add('is-changing');
      window.setTimeout(function () {
        index = (index + 1) % words.length;
        target.textContent = words[index];
        target.classList.remove('is-changing');
      }, 220);
    }, 3300);

    cleanups.push(function () { window.clearInterval(timer); });
  }

  function initPet(root, cleanups) {
    var pet = root.querySelector('[data-pet]');
    if (!pet) return;

    var button = pet.querySelector('.moon-pet-button');
    var message = pet.querySelector('[data-pet-message]');
    if (!button || !message) return;

    var messages = [
      '嗨，欢迎来到我的知识轨道。',
      '终端状态正常，放心探索。',
      '想看新内容？从精选笔记开始吧。',
      '把复杂问题拆开，再一点点写明白。',
      'AI、系统与安全，我都帮你归档好了。'
    ];
    var messageIndex = 0;
    var bounceTimer = null;
    var talkTimer = null;
    var pointerFrame = null;
    var latestPointer = null;

    function sayHello() {
      messageIndex = (messageIndex + 1) % messages.length;
      message.textContent = messages[messageIndex];
      pet.classList.remove('is-talking', 'is-bouncing');
      void pet.offsetWidth;
      pet.classList.add('is-talking', 'is-bouncing');

      window.clearTimeout(bounceTimer);
      window.clearTimeout(talkTimer);
      bounceTimer = window.setTimeout(function () { pet.classList.remove('is-bouncing'); }, 560);
      talkTimer = window.setTimeout(function () { pet.classList.remove('is-talking'); }, 900);
    }

    function updateEyes() {
      pointerFrame = null;
      if (!latestPointer || reduceMotion.matches) return;

      var rect = button.getBoundingClientRect();
      var centerX = rect.left + rect.width / 2;
      var centerY = rect.top + rect.height / 2;
      var eyeX = clamp((latestPointer.clientX - centerX) / 34, -2.4, 2.4);
      var eyeY = clamp((latestPointer.clientY - centerY) / 34, -2.1, 2.1);
      pet.style.setProperty('--pet-eye-x', eyeX.toFixed(2) + 'px');
      pet.style.setProperty('--pet-eye-y', eyeY.toFixed(2) + 'px');
    }

    function trackPointer(event) {
      latestPointer = event;
      if (pointerFrame === null) pointerFrame = window.requestAnimationFrame(updateEyes);
    }

    function resetEyes() {
      latestPointer = null;
      pet.style.setProperty('--pet-eye-x', '0px');
      pet.style.setProperty('--pet-eye-y', '0px');
    }

    button.addEventListener('click', sayHello);
    root.addEventListener('pointermove', trackPointer, { passive: true });
    root.addEventListener('pointerleave', resetEyes, { passive: true });

    cleanups.push(function () {
      window.clearTimeout(bounceTimer);
      window.clearTimeout(talkTimer);
      if (pointerFrame !== null) window.cancelAnimationFrame(pointerFrame);
      button.removeEventListener('click', sayHello);
      root.removeEventListener('pointermove', trackPointer);
      root.removeEventListener('pointerleave', resetEyes);
    });
  }

  function initSpotlights(root, cleanups) {
    var cards = root.querySelectorAll('[data-spotlight]');

    cards.forEach(function (card) {
      function moveSpotlight(event) {
        var rect = card.getBoundingClientRect();
        card.style.setProperty('--spot-x', (event.clientX - rect.left) + 'px');
        card.style.setProperty('--spot-y', (event.clientY - rect.top) + 'px');
      }

      card.addEventListener('pointermove', moveSpotlight, { passive: true });
      cleanups.push(function () { card.removeEventListener('pointermove', moveSpotlight); });
    });
  }

  function initTerminal(root, cleanups) {
    var form = root.querySelector('[data-terminal-form]');
    var input = root.querySelector('[data-terminal-input]');
    var output = root.querySelector('[data-terminal-output]');
    var screen = root.querySelector('[data-terminal-screen]');
    var clock = root.querySelector('[data-terminal-clock]');
    var livePrompt = root.querySelector('[data-terminal-prompt]');
    var terminalTitle = root.querySelector('[data-terminal-title]');
    var terminalStatus = root.querySelector('[data-terminal-status]');
    var terminalStatusLabel = root.querySelector('[data-terminal-status-label]');
    var recentList = root.querySelector('[data-terminal-recents]');
    var quickCommands = root.querySelectorAll('[data-terminal-command]');

    if (!form || !input || !output || !screen) return;

    var history = [];
    var historyIndex = 0;
    var historyDraft = '';
    var navigationTimer = null;
    var focusTimer = null;
    var completionBlock = null;
    var pager = null;
    var currentDirectory = '/';
    var finePointer = window.matchMedia('(pointer: fine)');
    var fileContentCache = Object.create(null);
    var filesystemLoaded = false;
    var filesystem = {
      posts: [],
      categories: [],
      tags: [],
      archives: []
    };
    var routes = {
      blog: '/blog/',
      about: '/about/',
      categories: '/categories/',
      tags: '/tags/',
      archives: '/archives/',
      github: 'https://github.com/FakeEyes2Wo'
    };
    var directoryRoutes = {
      '/blog': '/blog/',
      '/about': '/about/',
      '/categories': '/categories/',
      '/tags': '/tags/',
      '/archives': '/archives/'
    };
    var commandNames = [
      'help',
      'ls',
      'cd',
      'pwd',
      'cat',
      'more',
      'open',
      'clear',
      'history',
      'recent',
      'whoami',
      'focus',
      'date',
      'echo',
      'blog',
      'about',
      'categories',
      'tags',
      'archives',
      'github'
    ];
    var fileContents = {
      '/about.txt': '记录 AI / Agent、机器学习、强化学习，以及系统与安全方向的学习和工程实践。',
      '/focus.txt': 'AI4S\nResearch Agents\nReinforcement Learning\nSystems\nSecurity',
      '/README.md': [
        'Welcome to Iron Moon Shell.',
        '',
        'Try: ls blog',
        '     cd blog',
        '     pwd',
        '     cat ../focus.txt',
        '     more blog/<post>.md',
        '     open .',
        '',
        'Press Tab to complete commands and paths.'
      ].join('\n')
    };

    function setTerminalStatus(label, isDegraded) {
      if (terminalStatusLabel) terminalStatusLabel.textContent = label;
      if (terminalStatus) terminalStatus.classList.toggle('is-degraded', Boolean(isDegraded));
    }

    function renderInitialRecents(items, isDegraded) {
      if (!recentList) return;

      recentList.replaceChildren();
      var recentPosts = (items || []).slice(0, 3);

      if (!recentPosts.length) {
        var fallback = document.createElement('a');
        fallback.className = 'terminal-recent-row terminal-recent-fallback';
        fallback.href = routes.blog;
        fallback.textContent = isDegraded ? 'index unavailable · open blog/' : '(no posts yet)';
        recentList.appendChild(fallback);
        return;
      }

      recentPosts.forEach(function (post) {
        var link = document.createElement('a');
        var date = document.createElement('time');
        var title = document.createElement('span');
        var arrow = document.createElement('i');

        link.className = 'terminal-recent-row';
        link.href = post.url || routes.blog;
        date.dateTime = post.date || '';
        date.textContent = post.date || '----------';
        title.textContent = post.title || post.name || 'untitled';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '↗';

        link.appendChild(date);
        link.appendChild(title);
        link.appendChild(arrow);
        recentList.appendChild(link);
      });
    }

    var filesystemReady = window.fetch(
      '/terminal-fs.json?v=20260716-more',
      { cache: 'no-cache' }
    )
      .then(function (response) {
        if (!response.ok) throw new Error('filesystem manifest unavailable');
        return response.json();
      })
      .then(function (manifest) {
        filesystem = manifest || filesystem;
        filesystemLoaded = true;
        setTerminalStatus('INDEX ONLINE', false);
        renderInitialRecents(filesystem.posts, false);
        return filesystem;
      })
      .catch(function () {
        filesystemLoaded = true;
        setTerminalStatus('LOCAL MODE', true);
        renderInitialRecents([], true);
        return filesystem;
      });

    function scrollToBottom() {
      window.requestAnimationFrame(function () {
        screen.scrollTop = screen.scrollHeight;
      });
    }

    function formatShellPath(path) {
      return path === '/' ? '~' : '~' + path;
    }

    function getPromptText() {
      return 'visitor@iron-moon:' + formatShellPath(currentDirectory) + '$';
    }

    function getPhysicalPath() {
      return '/home/visitor' + (currentDirectory === '/' ? '' : currentDirectory);
    }

    function updatePrompt() {
      if (livePrompt) livePrompt.textContent = getPromptText();
      if (terminalTitle) terminalTitle.textContent = 'ironmoon@moonbase: ' + formatShellPath(currentDirectory);
    }

    function createCommandBlock(command) {
      var block = document.createElement('div');
      var commandLine = document.createElement('div');
      var prompt = document.createElement('span');
      var commandText = document.createElement('span');

      block.className = 'terminal-output-block';
      commandLine.className = 'terminal-output-command';
      prompt.className = 'terminal-output-prompt';
      prompt.textContent = getPromptText();
      commandText.textContent = command;
      commandLine.appendChild(prompt);
      commandLine.appendChild(commandText);
      block.appendChild(commandLine);
      output.appendChild(block);

      return block;
    }

    function appendText(block, text, className) {
      var line = document.createElement('div');
      line.className = className || 'terminal-output-text';
      line.textContent = text;
      block.appendChild(line);
      return line;
    }

    function appendEntries(block, entries) {
      if (!entries.length) {
        appendText(block, '(empty)');
        return;
      }

      var list = document.createElement('div');
      list.className = 'terminal-output-list';

      entries.forEach(function (entry) {
        var row = document.createElement('div');
        var name;

        row.className = 'terminal-output-entry';

        if (entry.url) {
          name = document.createElement('a');
          name.href = entry.url;
          if (/^https?:\/\//.test(entry.url)) {
            name.target = '_blank';
            name.rel = 'noopener';
          }
        } else {
          name = document.createElement('span');
        }

        name.className = entry.type === 'directory' ? 'is-directory' : '';
        name.textContent = entry.name;
        row.appendChild(name);

        if (entry.meta) {
          var meta = document.createElement('span');
          meta.className = 'terminal-output-entry-meta';
          meta.textContent = entry.meta;
          row.appendChild(meta);
        }

        list.appendChild(row);
      });

      block.appendChild(list);
    }

    function appendLink(block, label, url) {
      var line = document.createElement('div');
      var anchor = document.createElement('a');

      line.className = 'terminal-output-text terminal-output-link';
      anchor.href = url;
      anchor.textContent = label;
      if (/^https?:\/\//.test(url)) {
        anchor.target = '_blank';
        anchor.rel = 'noopener';
      }
      line.appendChild(anchor);
      block.appendChild(line);
    }

    function navigate(command, url) {
      var block = createCommandBlock(command);
      appendText(block, 'opening ' + url + ' ...', 'terminal-output-text terminal-output-success');
      scrollToBottom();

      window.clearTimeout(navigationTimer);
      navigationTimer = window.setTimeout(function () {
        if (/^https?:\/\//.test(url)) window.location.href = url;
        else window.location.assign(url);
      }, reduceMotion.matches ? 0 : 220);
    }

    function normalizePath(rawPath) {
      var path = String(rawPath || '.').trim();
      var parts = [];

      if (!path || path === '.') return currentDirectory;
      if (path === '~') return '/';
      if (path.indexOf('~/') === 0) path = '/' + path.slice(2);
      if (path.charAt(0) !== '/') {
        path = (currentDirectory === '/' ? '/' : currentDirectory + '/') + path;
      }

      path.split('/').forEach(function (part) {
        if (!part || part === '.') return;
        if (part === '..') {
          parts.pop();
          return;
        }
        parts.push(part);
      });

      return '/' + parts.join('/');
    }

    function rootEntries() {
      return [
        { name: 'blog/', type: 'directory', url: routes.blog },
        { name: 'about/', type: 'directory', url: routes.about },
        { name: 'categories/', type: 'directory', url: routes.categories },
        { name: 'tags/', type: 'directory', url: routes.tags },
        { name: 'archives/', type: 'directory', url: routes.archives },
        { name: 'about.txt', type: 'file' },
        { name: 'focus.txt', type: 'file' },
        { name: 'README.md', type: 'file' },
        { name: 'github', type: 'link', url: routes.github }
      ];
    }

    function manifestEntries(items, type) {
      return (items || []).map(function (item) {
        var meta = '';
        if (item.date) meta = item.date;
        else if (typeof item.count === 'number') meta = item.count + ' item' + (item.count === 1 ? '' : 's');

        return {
          name: item.name,
          title: item.title,
          type: type,
          url: item.url,
          contentUrl: item.contentUrl,
          meta: meta
        };
      });
    }

    function getDirectoryEntries(path) {
      switch (path) {
        case '/':
          return rootEntries();
        case '/blog':
          return manifestEntries(filesystem.posts, 'file');
        case '/categories':
          return manifestEntries(filesystem.categories, 'directory');
        case '/tags':
          return manifestEntries(filesystem.tags, 'directory');
        case '/archives':
          return manifestEntries(filesystem.archives, 'directory');
        default:
          return [];
      }
    }

    function entryName(entry) {
      return entry.name.replace(/\/$/, '');
    }

    function findEntry(path) {
      if (path === '/') {
        return { name: '~/', type: 'directory', path: '/', url: '/' };
      }

      if (directoryRoutes[path]) {
        return {
          name: path.split('/').pop() + '/',
          type: 'directory',
          path: path,
          url: directoryRoutes[path]
        };
      }

      if (fileContents[path] !== undefined) {
        return {
          name: path.split('/').pop(),
          type: 'file',
          path: path,
          content: fileContents[path]
        };
      }

      var slashIndex = path.lastIndexOf('/');
      var parentPath = slashIndex > 0 ? path.slice(0, slashIndex) : '/';
      var name = path.slice(slashIndex + 1);
      var entries = getDirectoryEntries(parentPath);
      var exact = entries.find(function (entry) {
        return entryName(entry) === name;
      });

      if (!exact) {
        var insensitive = entries.filter(function (entry) {
          return entryName(entry).toLowerCase() === name.toLowerCase();
        });
        if (insensitive.length === 1) exact = insensitive[0];
      }

      if (!exact) return null;

      return {
        name: exact.name,
        title: exact.title,
        type: exact.type,
        path: (parentPath === '/' ? '' : parentPath) + '/' + entryName(exact),
        url: exact.url,
        contentUrl: exact.contentUrl,
        meta: exact.meta
      };
    }

    function tokenizeCommand(value) {
      var tokens = [];
      var current = '';
      var quote = null;
      var escaped = false;

      for (var index = 0; index < value.length; index += 1) {
        var character = value.charAt(index);

        if (escaped) {
          current += character;
          escaped = false;
        } else if (character === '\\') {
          escaped = true;
        } else if (quote) {
          if (character === quote) quote = null;
          else current += character;
        } else if (character === '"' || character === "'") {
          quote = character;
        } else if (/\s/.test(character)) {
          if (current) {
            tokens.push(current);
            current = '';
          }
        } else {
          current += character;
        }
      }

      if (escaped) current += '\\';
      if (quote) return { tokens: tokens, error: 'shell: unmatched quote' };
      if (current) tokens.push(current);

      return { tokens: tokens, error: null };
    }

    function withFilesystem(block, callback) {
      if (filesystemLoaded) {
        callback();
        scrollToBottom();
        return;
      }

      var loading = appendText(
        block,
        'loading filesystem ...',
        'terminal-output-text terminal-output-loading'
      );

      filesystemReady.then(function () {
        if (loading.parentNode) loading.parentNode.removeChild(loading);
        callback();
        scrollToBottom();
      });
    }

    function listPath(block, rawPath) {
      var path = normalizePath(rawPath || '.');
      var target = findEntry(path);

      if (!target) {
        appendText(
          block,
          "ls: cannot access '" + (rawPath || '.') + "': No such file or directory",
          'terminal-output-text terminal-output-error'
        );
        return;
      }

      if (target.type === 'directory') {
        appendEntries(block, getDirectoryEntries(target.path));
      } else {
        appendEntries(block, [{
          name: target.name,
          type: target.type,
          url: target.url,
          meta: target.meta
        }]);
      }
    }

    function changeDirectory(block, rawPath) {
      var path = normalizePath(rawPath || '~');
      var target = findEntry(path);

      if (!target) {
        appendText(
          block,
          'cd: ' + (rawPath || '~') + ': No such file or directory',
          'terminal-output-text terminal-output-error'
        );
        return;
      }

      if (target.type !== 'directory') {
        appendText(
          block,
          'cd: ' + (rawPath || '~') + ': Not a directory',
          'terminal-output-text terminal-output-error'
        );
        return;
      }

      currentDirectory = target.path;
      updatePrompt();
    }

    function readableTarget(block, command, rawPath) {
      var path = normalizePath(rawPath);
      var target = findEntry(path);

      if (!target) {
        appendText(
          block,
          command + ': ' + rawPath + ': No such file or directory',
          'terminal-output-text terminal-output-error'
        );
        return null;
      }

      if (target.type === 'directory') {
        appendText(
          block,
          command + ': ' + rawPath + ': Is a directory',
          'terminal-output-text terminal-output-error'
        );
        return null;
      }

      return target;
    }

    function loadFileContent(target) {
      if (target.content !== undefined) return Promise.resolve(target.content);

      if (!target.contentUrl) {
        if (target.url) return Promise.resolve(target.url);
        return Promise.reject(new Error('not a readable file'));
      }

      if (!fileContentCache[target.contentUrl]) {
        fileContentCache[target.contentUrl] = window.fetch(
          target.contentUrl + '?v=20260716-more',
          { cache: 'no-cache' }
        ).then(function (response) {
          if (!response.ok) throw new Error('failed to read file');
          return response.text();
        }).catch(function (error) {
          delete fileContentCache[target.contentUrl];
          throw error;
        });
      }

      return fileContentCache[target.contentUrl];
    }

    function appendFileContent(block, text) {
      return appendText(
        block,
        String(text || ''),
        'terminal-output-text terminal-file-content'
      );
    }

    function catPath(block, rawPath) {
      var target = readableTarget(block, 'cat', rawPath);
      if (!target) return Promise.resolve();

      var loading = appendText(
        block,
        'reading ' + rawPath + ' ...',
        'terminal-output-text terminal-output-loading'
      );

      return loadFileContent(target)
        .then(function (text) {
          if (loading.parentNode) loading.parentNode.removeChild(loading);
          appendFileContent(block, text);
          scrollToBottom();
        })
        .catch(function () {
          if (loading.parentNode) loading.parentNode.removeChild(loading);
          appendText(
            block,
            'cat: ' + rawPath + ': Failed to read file',
            'terminal-output-text terminal-output-error'
          );
          scrollToBottom();
        });
    }

    function pagerPageSize() {
      var style = window.getComputedStyle(screen);
      var lineHeight = parseFloat(style.lineHeight) || 24;
      return Math.max(8, Math.floor((screen.clientHeight - 120) / lineHeight));
    }

    function finishPager(restoreFocus) {
      if (!pager) return;

      if (pager.status.parentNode) pager.status.parentNode.removeChild(pager.status);
      form.classList.remove('is-paging');
      pager = null;
      if (restoreFocus !== false) input.focus({ preventScroll: true });
      scrollToBottom();
    }

    function revealPagerLines(count) {
      if (!pager) return;

      pager.index = Math.min(pager.lines.length, pager.index + count);
      pager.content.textContent = pager.lines.slice(0, pager.index).join('\n');

      if (pager.index >= pager.lines.length) {
        finishPager();
        return;
      }

      var percentage = Math.max(
        1,
        Math.min(99, Math.round((pager.index / pager.lines.length) * 100))
      );
      pager.status.textContent =
        '--More--(' + percentage + '%)  [Space:page | Enter:line | q:quit]';
      scrollToBottom();
    }

    function startPager(block, rawPath, text) {
      if (pager) finishPager(false);

      var content = document.createElement('div');
      var status = document.createElement('div');
      var normalizedText = String(text || '').replace(/\r\n?/g, '\n').replace(/\n$/, '');

      content.className = 'terminal-output-text terminal-file-content terminal-more-content';
      status.className = 'terminal-more-status';
      status.setAttribute('role', 'button');
      status.setAttribute('tabindex', '0');
      status.setAttribute('aria-label', 'Show the next page');
      status.addEventListener('click', function () {
        if (pager) revealPagerLines(pager.pageSize);
      });
      block.appendChild(content);
      block.appendChild(status);

      pager = {
        path: rawPath,
        lines: normalizedText.split('\n'),
        index: 0,
        pageSize: pagerPageSize(),
        content: content,
        status: status
      };

      form.classList.add('is-paging');
      input.blur();
      screen.tabIndex = -1;
      screen.focus({ preventScroll: true });
      revealPagerLines(pager.pageSize);
    }

    function morePath(block, rawPath) {
      var target = readableTarget(block, 'more', rawPath);
      if (!target) return Promise.resolve();

      var loading = appendText(
        block,
        'reading ' + rawPath + ' ...',
        'terminal-output-text terminal-output-loading'
      );

      return loadFileContent(target)
        .then(function (text) {
          if (loading.parentNode) loading.parentNode.removeChild(loading);
          if (!block.isConnected) return;
          startPager(block, rawPath, text);
        })
        .catch(function () {
          if (loading.parentNode) loading.parentNode.removeChild(loading);
          appendText(
            block,
            'more: ' + rawPath + ': Failed to read file',
            'terminal-output-text terminal-output-error'
          );
          scrollToBottom();
        });
    }

    function handlePagerKeydown(event) {
      if (!pager || event.isComposing) return;

      var handled = true;
      if (event.key === ' ' || event.key === 'PageDown' || event.key.toLowerCase() === 'f') {
        revealPagerLines(pager.pageSize);
      } else if (event.key === 'Enter' || event.key === 'ArrowDown' || event.key.toLowerCase() === 'j') {
        revealPagerLines(1);
      } else if (
        event.key === 'q' ||
        event.key === 'Q' ||
        event.key === 'Escape' ||
        (event.ctrlKey && event.key.toLowerCase() === 'c')
      ) {
        finishPager();
      } else if (event.ctrlKey && event.key.toLowerCase() === 'l') {
        finishPager();
        execute('clear');
      } else if (
        event.key === 'Tab' ||
        event.key === 'ArrowUp' ||
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight' ||
        event.key === 'Home' ||
        event.key === 'End' ||
        (!event.ctrlKey && !event.metaKey && event.key.length === 1)
      ) {
        // Ignore other editing keys while the pager owns the terminal.
      } else {
        handled = false;
      }

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function openPath(original, rawPath) {
      var routeName = String(rawPath || '').toLowerCase().replace(/\/$/, '');
      if (routes[routeName]) {
        navigate(original, routes[routeName]);
        return;
      }

      var target = findEntry(normalizePath(rawPath || '.'));
      if (!target) {
        var missingBlock = createCommandBlock(original);
        appendText(
          missingBlock,
          'open: ' + (rawPath || '') + ': No such file or directory',
          'terminal-output-text terminal-output-error'
        );
        scrollToBottom();
        return;
      }

      if (!target.url) {
        var unavailableBlock = createCommandBlock(original);
        appendText(
          unavailableBlock,
          'open: ' + rawPath + ': No browser target',
          'terminal-output-text terminal-output-error'
        );
        scrollToBottom();
        return;
      }

      navigate(original, target.url);
    }

    function helpMessage(command) {
      var details = {
        ls: 'ls [path]       list a directory, e.g. ls blog',
        cd: 'cd [path]       change directory, e.g. cd blog',
        pwd: 'pwd             print the current virtual path',
        cat: 'cat <file...>   print a virtual file or post entry',
        more: 'more <file>     read a file page by page',
        open: 'open <path>     open a directory, post or route',
        recent: 'recent [count] show the newest posts (default: 5)',
        clear: 'clear           clear the terminal session'
      };

      if (command && details[command]) return details[command];
      if (command) return 'help: no help topic for ' + command;

      return [
        'help [command]  show command help',
        details.ls,
        details.cd,
        details.pwd,
        details.cat,
        details.more,
        details.open,
        details.recent,
        'history         show command history',
        'whoami          show the site owner',
        'focus           show current interests',
        'date            show the current time',
        'echo <text>      print text',
        details.clear,
        '',
        'Tip: press Tab to complete commands and paths.'
      ].join('\n');
    }

    function execute(rawCommand) {
      var original = rawCommand.trim();
      if (!original) return;

      var parsed = tokenizeCommand(original);
      if (parsed.error) {
        var parseErrorBlock = createCommandBlock(original);
        appendText(parseErrorBlock, parsed.error, 'terminal-output-text terminal-output-error');
        scrollToBottom();
        return;
      }

      var parts = parsed.tokens;
      var command = String(parts.shift() || '').toLowerCase();
      var argumentsList = parts;

      if (command === 'clear' || command === 'cls') {
        finishPager();
        output.replaceChildren();
        screen.classList.add('is-cleared');
        completionBlock = null;
        scrollToBottom();
        return;
      }

      if (routes[command] && !argumentsList.length) {
        navigate(original, routes[command]);
        return;
      }

      if (command === 'open') {
        if (argumentsList.length !== 1) {
          var openErrorBlock = createCommandBlock(original);
          appendText(
            openErrorBlock,
            argumentsList.length ? 'open: too many arguments' : 'open: missing path',
            'terminal-output-text terminal-output-error'
          );
          scrollToBottom();
          return;
        }

        var openBlock = createCommandBlock(original);
        var openLoading = appendText(
          openBlock,
          'resolving path ...',
          'terminal-output-text terminal-output-loading'
        );
        filesystemReady.then(function () {
          if (openBlock.parentNode) openBlock.parentNode.removeChild(openBlock);
          if (openLoading.parentNode) openLoading.parentNode.removeChild(openLoading);
          openPath(original, argumentsList[0]);
        });
        return;
      }

      var block = createCommandBlock(original);

      switch (command) {
        case 'help':
          appendText(block, helpMessage(String(argumentsList[0] || '').toLowerCase()));
          break;

        case 'whoami':
          appendText(block, 'iron moon — learning, building, documenting.');
          break;

        case 'focus':
          appendText(block, 'AI4S / Research Agents / Reinforcement Learning / Systems / Security');
          break;

        case 'ls':
          if (argumentsList.length > 1) {
            appendText(block, 'ls: too many operands', 'terminal-output-text terminal-output-error');
          } else if (argumentsList[0] && argumentsList[0].charAt(0) === '-') {
            appendText(
              block,
              'ls: unsupported option ' + argumentsList[0],
              'terminal-output-text terminal-output-error'
            );
          } else {
            withFilesystem(block, function () {
              listPath(block, argumentsList[0]);
            });
          }
          break;

        case 'cd':
          if (argumentsList.length > 1) {
            appendText(block, 'cd: too many arguments', 'terminal-output-text terminal-output-error');
          } else {
            withFilesystem(block, function () {
              changeDirectory(block, argumentsList[0]);
            });
          }
          break;

        case 'pwd':
          appendText(block, getPhysicalPath());
          break;

        case 'date':
          appendText(block, new Date().toLocaleString('zh-CN', { hour12: false }));
          break;

        case 'echo':
          appendText(block, argumentsList.join(' '));
          break;

        case 'cat':
          if (!argumentsList.length) {
            appendText(
              block,
              'cat: missing file operand',
              'terminal-output-text terminal-output-error'
            );
          } else {
            withFilesystem(block, function () {
              argumentsList.forEach(function (path, index) {
                if (index > 0) appendText(block, '');
                catPath(block, path);
              });
            });
          }
          break;

        case 'more':
          if (!argumentsList.length) {
            appendText(
              block,
              'more: missing file operand',
              'terminal-output-text terminal-output-error'
            );
          } else if (argumentsList.length > 1) {
            appendText(
              block,
              'more: too many arguments',
              'terminal-output-text terminal-output-error'
            );
          } else {
            withFilesystem(block, function () {
              morePath(block, argumentsList[0]);
            });
          }
          break;

        case 'history':
          appendText(
            block,
            history.map(function (item, index) {
              return String(index + 1).padStart(3, ' ') + '  ' + item;
            }).join('\n')
          );
          break;

        case 'recent':
          if (argumentsList.length > 1 || (argumentsList[0] && !/^\d+$/.test(argumentsList[0]))) {
            appendText(
              block,
              'recent: usage: recent [count]',
              'terminal-output-text terminal-output-error'
            );
          } else {
            var recentCount = Math.min(Math.max(Number(argumentsList[0] || 5), 1), 20);
            withFilesystem(block, function () {
              appendEntries(
                block,
                manifestEntries(filesystem.posts.slice(0, recentCount), 'file')
              );
            });
          }
          break;

        default:
          appendText(
            block,
            original + ': command not found. Type "help" to continue.',
            'terminal-output-text terminal-output-error'
          );
      }

      scrollToBottom();
    }

    function clearCompletion() {
      if (completionBlock && completionBlock.parentNode) {
        completionBlock.parentNode.removeChild(completionBlock);
      }
      completionBlock = null;
    }

    function showCompletions(candidates) {
      clearCompletion();
      completionBlock = document.createElement('div');
      completionBlock.className = 'terminal-completion-list';
      completionBlock.textContent = candidates.join('    ');
      output.appendChild(completionBlock);
      scrollToBottom();
    }

    function longestCommonPrefix(values) {
      if (!values.length) return '';
      var prefix = values[0];

      for (var index = 1; index < values.length; index += 1) {
        while (
          prefix &&
          values[index].slice(0, prefix.length).toLowerCase() !== prefix.toLowerCase()
        ) {
          prefix = prefix.slice(0, -1);
        }
      }

      return prefix;
    }

    function pathCandidates(word, command) {
      var slashIndex = word.lastIndexOf('/');
      var typedDirectory = slashIndex >= 0 ? word.slice(0, slashIndex + 1) : '';
      var fragment = slashIndex >= 0 ? word.slice(slashIndex + 1) : word;
      var directoryPath = typedDirectory ? normalizePath(typedDirectory) : currentDirectory;
      var entries = getDirectoryEntries(directoryPath);

      return entries
        .filter(function (entry) {
          if (command === 'cd' && entry.type !== 'directory') return false;
          if (
            (command === 'cat' || command === 'more') &&
            entry.type === 'directory'
          ) return false;
          return entryName(entry).toLowerCase().indexOf(fragment.toLowerCase()) === 0;
        })
        .map(function (entry) {
          return typedDirectory + entry.name;
        })
        .sort(function (first, second) {
          return first.localeCompare(second, 'zh-CN');
        });
    }

    function replaceInputWord(value, wordStart, cursor, replacement, appendSpace) {
      var nextValue = value.slice(0, wordStart) + replacement +
        (appendSpace ? ' ' : '') + value.slice(cursor);
      var nextCursor = wordStart + replacement.length + (appendSpace ? 1 : 0);

      input.value = nextValue;
      input.setSelectionRange(nextCursor, nextCursor);
    }

    function completeInput() {
      var value = input.value;
      var cursor = typeof input.selectionStart === 'number' ? input.selectionStart : value.length;
      var beforeCursor = value.slice(0, cursor);
      var wordMatch = beforeCursor.match(/[^\s]*$/);
      var word = wordMatch ? wordMatch[0] : '';
      var wordStart = cursor - word.length;
      var beforeWord = beforeCursor.slice(0, wordStart);
      var firstWordMatch = value.trimStart().match(/^([^\s]*)/);
      var firstWord = firstWordMatch ? firstWordMatch[1].toLowerCase() : '';
      var commandPosition = beforeWord.trim() === '';
      var candidates = [];

      if (commandPosition) {
        candidates = commandNames
          .filter(function (name) {
            return name.indexOf(word.toLowerCase()) === 0;
          })
          .sort();
      } else if (firstWord === 'help') {
        candidates = commandNames
          .filter(function (name) {
            return name.indexOf(word.toLowerCase()) === 0;
          })
          .sort();
      } else if (['ls', 'cd', 'cat', 'more', 'open'].indexOf(firstWord) !== -1) {
        candidates = pathCandidates(word, firstWord);
      }

      if (!candidates.length) {
        clearCompletion();
        return;
      }

      if (candidates.length === 1) {
        var only = candidates[0];
        var appendSpace = commandPosition || only.charAt(only.length - 1) !== '/';
        replaceInputWord(value, wordStart, cursor, only, appendSpace);
        clearCompletion();
        return;
      }

      var commonPrefix = longestCommonPrefix(candidates);
      if (commonPrefix.length > word.length) {
        replaceInputWord(value, wordStart, cursor, commonPrefix, false);
      } else {
        showCompletions(candidates);
      }
    }

    function runInputCommand() {
      var command = input.value;
      if (!command.trim()) return;

      command = command.trim();
      if (history[history.length - 1] !== command) history.push(command);
      historyIndex = history.length;
      historyDraft = '';
      input.value = '';
      clearCompletion();
      execute(command);
    }

    function submitCommand(event) {
      event.preventDefault();
      if (pager) {
        revealPagerLines(pager.pageSize);
        return;
      }
      runInputCommand();
    }

    function handleHistory(event) {
      if (event.key === 'ArrowUp' && history.length) {
        event.preventDefault();
        if (historyIndex === history.length) historyDraft = input.value;
        historyIndex = Math.max(0, historyIndex - 1);
        input.value = history[historyIndex] || '';
        input.setSelectionRange(input.value.length, input.value.length);
      } else if (event.key === 'ArrowDown' && history.length) {
        event.preventDefault();
        historyIndex = Math.min(history.length, historyIndex + 1);
        input.value = historyIndex === history.length ? historyDraft : (history[historyIndex] || '');
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }

    function handleInputKeydown(event) {
      if (event.isComposing) return;

      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        runInputCommand();
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        filesystemReady.then(completeInput);
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        input.value = '';
        execute('clear');
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        input.value = '';
        historyIndex = history.length;
        historyDraft = '';
        clearCompletion();
        return;
      }

      clearCompletion();
      handleHistory(event);
    }

    function focusInput(event) {
      if (pager) return;
      if (
        event &&
        event.target instanceof Element &&
        event.target.closest('a, button, input')
      ) return;

      if (event && !finePointer.matches) return;

      var selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;

      input.focus({ preventScroll: true });
    }

    function updateClock() {
      if (!clock) return;
      var now = new Date();
      clock.dateTime = now.toISOString();
      clock.textContent = now.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    }

    form.addEventListener('submit', submitCommand);
    input.addEventListener('keydown', handleInputKeydown);
    input.addEventListener('input', clearCompletion);
    screen.addEventListener('click', focusInput);
    document.addEventListener('keydown', handlePagerKeydown, true);

    quickCommands.forEach(function (button) {
      function runQuickCommand() {
        var command = button.getAttribute('data-terminal-command') || '';
        execute(command);
        if (finePointer.matches) input.focus({ preventScroll: true });
      }

      button.addEventListener('click', runQuickCommand);
      cleanups.push(function () { button.removeEventListener('click', runQuickCommand); });
    });

    updateClock();
    updatePrompt();
    var clockTimer = window.setInterval(updateClock, 1000);

    if (finePointer.matches) {
      focusTimer = window.setTimeout(function () {
        if (
          document.activeElement === document.body ||
          document.activeElement === document.documentElement
        ) {
          input.focus({ preventScroll: true });
        }
      }, 420);
    }

    cleanups.push(function () {
      window.clearInterval(clockTimer);
      window.clearTimeout(navigationTimer);
      window.clearTimeout(focusTimer);
      finishPager(false);
      form.removeEventListener('submit', submitCommand);
      input.removeEventListener('keydown', handleInputKeydown);
      input.removeEventListener('input', clearCompletion);
      screen.removeEventListener('click', focusInput);
      document.removeEventListener('keydown', handlePagerKeydown, true);
    });
  }

  function createHomeController(root) {
    var cleanups = [];
    var canvas = root.querySelector('[data-particles]');

    if (canvas && !reduceMotion.matches) {
      var particleField = new ParticleField(canvas, root.querySelector('.home-hero') || root);
      particleField.init();
      cleanups.push(function () { particleField.destroy(); });
    }

    initRotatingText(root, cleanups);
    initPet(root, cleanups);
    initSpotlights(root, cleanups);
    initTerminal(root, cleanups);

    return {
      root: root,
      destroy: function () {
        cleanups.forEach(function (cleanup) { cleanup(); });
      }
    };
  }

  function mountHome() {
    var root = document.querySelector('[data-home]');
    document.documentElement.classList.toggle('is-home-page', Boolean(root));

    if (activeController && activeController.root === root && root && root.isConnected) return;
    if (activeController) activeController.destroy();
    activeController = root ? createHomeController(root) : null;
  }

  function unmountHome() {
    if (activeController) activeController.destroy();
    activeController = null;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountHome, { once: true });
  } else {
    mountHome();
  }

  document.addEventListener('page:loaded', mountHome);
  document.addEventListener('pjax:send', unmountHome);
}());
