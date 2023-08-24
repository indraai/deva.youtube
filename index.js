// Copyright (c)2023 Quinn Michaels
// Youtube Deva
const fs = require('fs');
const path = require('path');

const {google} = require('googleapis');
const Oauth2 = google.auth.OAuth2;

const package = require('./package.json');
const info = {
  id: package.id,
  name: package.name,
  describe: package.description,
  version: package.version,
  url: package.homepage,
  dir: __dirname,
  git: package.repository.url,
  bugs: package.bugs.url,
  author: package.author,
  license: package.license,
  copyright: package.copyright,
};

const data_path = path.join(__dirname, 'data.json');
const {agent,vars} = require(data_path).data;

const Deva = require('@indra.ai/deva');
const YOUTUBE = new Deva({
  info,
  agent,
  vars,
  utils: {
    translate(input) {
      return input.trim();
    },
    parse(input) {
      return input.trim().split(':br:').join('\n').split(':p:').join('\n\n');
    }
  },
  listeners: {},
  modules: {
    oAuth: false,
    yt: false,
  },
  deva: {},
  func: {
    insert(func, params) {
      this.prompt('inside func insert');
      this.context('insert');
      return new Promise((resolve, reject) => {
        const {key, index} = this.vars.acct;
        this.modules[key][index].yt[func].insert(params, (err, response) => {
          if (err) return reject(err);
          return resolve(response);
        })
      });
    },

    _list(func,params) {
      return new Promise((resolve, reject) => {
        const {key, index} = this.vars.acct;
        this.modules[key][index].yt[func].list(params, (err, response) => {
          if (err) return this.error(err, params, reject);
          this.vars.acct.index = index ? 0 : 1;
          return resolve(response);
        });
      });
    },

    /**************
    func:     acct
    params:   a = account, i = index
    describe: This will switch youtube accounts from one that is already in the list.
    ***************/
    acct(opts) {
      return new Promise((resolve, reject) => {
        // if the accounts are the same then return the message
        if (this.vars.acct.key === opts.key) return resolve({text:this.vars.messages.acct});
        try {
          opts.index = opts.index || this.vars.acct.index; //temp storage for later.
          const {personal} = this.security();
          const acct = personal[opts.key][opts.index];
          if (!acct) return resolve({text:this.vars.messages.accounterr});
          this.vars.acct.key = opts.key;
          this.vars.acct.index = opts.index;
        } catch (err) {
          return this.error(err, opts, reject);
        } finally {
          return resolve({text:this.vars.messages.acct})
        }
      });
    },

    video(id) {
      this.context('video');
      let data = {};
      const {labels} = this.vars.messages;
      return new Promise((resolve, reject) => {
        if (!id) return reject(this.vars.messages.params);

        this.func._list('videos', {id, part: this.vars.params.video.part}).then(videos => {

          data = videos.data.items;
          const text = videos.data.items.map(itm => {
            const isLive = itm.snippet.liveBroadcastContent === 'live' ? true : false;
            return [
              `youtube:${itm.id}`,
              `title: ${itm.snippet.title}`,
              `published: ${itm.snippet.publishedAt}`,
              `describe: ${itm.snippet.description.replace(/\n|\r/g, ' ')}`,
              '::begin:buttons',
              `button[${labels.like}]:#youtube rate:${itm.id} like`,
              `button[${labels.comments}]:#youtube comments:${itm.id}`,
              `button[${labels.comment}]:#youtube comment:${itm.snippet.channelId}:${itm.id} `,
              isLive ? `button[${labels.livechat}]:#youtube chatid:${itm.liveStreamingDetails.activeLiveChatId}` : '',
              '::end:buttons',
            ].join('\n');
          }).join('\n');
          return this.question(`#feecting parse:${this.agent().key}:video ${text}`);
        }).then(parsed => {
          return resolve({
            text: parsed.a.text,
            html: parsed.a.html,
            data});
        }).catch(err => {
          return this.error(err, id, reject);
        });
      });
    },

    search(params) {
      // youtube search parameters
      // filters
      // - forContentOwner
      // - forDeveloper
      // - forMine
      // - relatedToVideoId
      // parameters
      // - channelId
      // - channelType (any|show)
      // - eventType (completed|live|upcoming) if used set type to "video"
      // - location (GPS)
      // - locationRadius
      // - maxResults
      // - onBehalfOfContentOwner
      // - order (date, rating, relevance, title, videoCount, viewCount)
      // - pageToken
      // - publishedAfter
      // - publishedBefore
      // - q
      // - regionCode
      // - relevanceLanguage
      // - safeSearch (moderate|none|strict)
      // - type (channel|playlist|video)
      // - videoCaption (any|closedCaption|none)
      // - videoCategoryId
      // - videoDefinition (any|high|standard)
      // - videoDimension (2d|3d|any)
      // - videoDuration (long|medium|short)
      // - videoEmbeddable (any|true)
      // - videoLicense (any|creativeCommon|youtube)
      // - videoSyndicated (any|true)
      // - videoType (any|episode|movie) if used set type to "video"
      return new Promise((resolve, reject) => {
        if (!params) return reject(this.vars.messages.params);
        this.func._list('search', params).then(result => {
          return resolve(result.data)
        }).catch(err => {
          return this.error(err, params, reject);
        });
      });
    },

    // get comments for a video
    comments(opts) {
      return new Promise((resolve, reject) => {
        let data;
        if (opts.meta.params[1]) this.vars.params.comments.videoId = opts.meta.params[1];
        if (opts.meta.params[2]) this.vars.params.comments.maxResults = opts.meta.params[2];


        this.func._list('commentThreads', this.vars.params.comments).then(result => {
          data = result.data;

          console.log('YOUTUBE COMMENTS', JSON.stringify(result.data, false, 2));

          const text = result.data.items.map(itm => {
            const {topLevelComment, canReply, totalReplyCount} = itm.snippet;
            const {
              authorProfileImageUrl,
              textOriginal,
              authorDisplayName,
              publishedAt,
              likeCount,
              videoId
            } = topLevelComment.snippet;
            return [
              `::begin:comment`,
              `avatar: ${authorProfileImageUrl}`,
              `::begin:details`,
              `::begin:text`,
              `${textOriginal}`,
              `::end:text`,
              `\n-\n`,
              `author: ${authorDisplayName}`,
              `date: ${publishedAt}`,
              `likes: ${likeCount}`,
              `::begin:buttons`,
              canReply ? `tty[reply]:#youtube reply:${topLevelComment.id}` : '',
              totalReplyCount ? `cmd[replies (${totalReplyCount})]:#youtube replies:${topLevelComment.id}` : '',
              `::end:buttons`,
              `::end:details`,
              `::end:comment`,
            ].join('\n');
          }).join('\n');

          return this.question(`#feecting parse:${this.agent().key}:comments ${text}`);
        }).then(parsed => {
          return resolve({
            text: parsed.a.text,
            html: parsed.a.html,
            data
          });
        }).catch(err => {
          return this.error(err, this.vars.params.comments, reject);
        });
      });
    },

    // get comments for a video
    replies(opts) {
      return new Promise((resolve, reject) => {
        if (opts.meta.params[1]) this.vars.params.replies.parentId = opts.meta.params[1];
        if (opts.meta.params[2]) this.vars.params.replies.maxResults = opts.meta.params[2];
        let data;

        this.func._list('comments', this.vars.params.replies).then(result => {
          data = result.data;

          console.log('YOUTUBE replies', JSON.stringify(result.data, false, 2));

          const text = result.data.items.map(itm => {
            const {textOriginal, authorDisplayName, authorProfileImageUrl, publishedAt, likeCount} = itm.snippet;

            return [
              `::begin:comment`,
              `avatar: ${authorProfileImageUrl}`,
              `::begin:details`,
              `::begin:text`,
              `${textOriginal}`,
              `::end:text`,
              `\n-\n`,
              `author: ${authorDisplayName}`,
              `date: ${publishedAt}`,
              `likes: ${likeCount}`,
              `::end:details`,
              `::end:comment`,
            ].join('\n');
          }).join('\n');

          return this.question(`#feecting parse:${this.agent().key}:replies ${text}`);
        }).then(parsed => {
          return resolve({
            text: parsed.a.text,
            html: parsed.a.html,
            data
          });
        }).catch(err => {
          return this.error(err, this.vars.params.comments, reject);
        });
      });
    },


    comment(text) {
      const {part, channelId, videoId} = this.vars.params.comment;
      // build the packet to send to youtube from the data element variables.
      const params = {
        part,
        resource: {
          snippet: {
            channelId,
            videoId,
            topLevelComment: {
              snippet: {
                textOriginal: this.utils.parse(text),
              }
            }
          }
        }
      };

      return new Promise((resolve, reject) => {
        if (!params) return reject(this.vars.messages.params);
        this.func.insert('commentThreads', params).then(result => {

          this.vars.params.reply.parentId = result.data.snippet.topLevelComment.id;
          return resolve({
            text,
            html: text,
            data: result.data
          });
        }).catch(err => {
          return this.error(err, text, reject);
        })
      });
    },
    /**************
    func: reply
    params: opts
    describe: this will post a reply comment to a specific id.
    ***************/
    reply(text) {
      const {part, parentId} = this.vars.params.reply;
      // build the packet to send to youtube from the data element variables.
      const params = {
        part,
        resource: {
          snippet: {
            parentId: parentId,
            textOriginal: text,
          }
        }
      };

      return new Promise((resolve, reject) => {
        if (!params) return reject(this.vars.messages.params);
        if (!parentId) return resolve(this.vars.messages.reply);
        this.func.insert('comments', params).then(result => {
          return resolve({
            text,
            html: text,
            data: result.data
          });
        }).catch(err => {
          return this.error(err, opts, reject);
        });
      });
    },

    rate(opts) {
      const {text, meta} = opts;
      // build the packet to send to youtube from the data element variables.
      return new Promise((resolve, reject) => {
        const {key, index} = this.vars.acct;
        if (!params) return reject(this.vars.messages.params);
        this.modules[key][index].yt.videos.rate({
          id: meta.params[1],
          rating: text ? text : 'like',
        }).then(result => {
          return resolve({text});
        }).catch(err => {
          return this.error(err, opts, reject);
        })
      });
    },

    channel(channelId) {
      this.vars.params.channel = {
        mine: true,
        part: this.vars.params.channel.part,
      };

      if (channelId) this.vars.params.channel = {
        id: channelId,
        part: this.vars.params.channel.part,
      };

      return new Promise((resolve, reject) => {
        this.func._list('channels', this.vars.params.channel).then(channels => {
          return resolve(channels.data.items[0])
        }).catch(err => {
          return this.error(err, channelId, reject);
        });
      });
    },

    playlist(params) {
      return new Promise((resolve, reject) => {
        if (!params.playlistId) return reject(this.vars.messages.params);
        this.func._list('playlistItems', params).then(pl => {
          return resolve(pl.data)
        }).catch(err => {
          return this.error(err, params, reject);
        });
      });
    },

    /**************
    func:     subscriptions function
    params:   none (uses local variable)
    describe: the function to return subscriptions from the youtube api.
              will accept an options object with a ChannelId and part as
              properties.
    ***************/
    subscriptions() {
      let params = {
        mine: true,
        part: this.vars.params.subscriptions.part,
      };
      if (this.vars.params.subscriptions.channelId) {
        params = {
          channelId:this.vars.subscriptions.channelId,
          part: this.vars.params.subscriptions.part,
        }
      }
      return new Promise((resolve, reject) => {
        this.func._list('subscriptions', params).then(subscr => {
          // set the subscriptions variable with a new map of subscr
          return resolve(subscr.data);
        }).catch(err => {
          return this.error(err, params, reject)
        });
      });
    },

    liveBroadcast(id=false) {
      return new Promise((resolve, reject) => {
        this.func._list('live', {
          id,
        }).then(broadcast => {
          return resolve(broadcast);
        }).catch(err => {
          return this.error(err, id, reject);
        })
      });
    },

    liveChat(text) {
      this.context('livechat');
      return new Promise((resolve, reject) => {
        let data = {};
        if (!this.vars.params.liveChatMessages.liveChatId) return resolve({text:false});
        this.func.insert('liveChatMessages', {
          part: 'snippet',
          properties: {
            'snippet.liveChatId': this.vars.params.liveChatMessages.liveChatId,
            'snippet.textMessageDetails.messageText': text,
            'snippet.type': 'textMessageEvent',
          },
          resource: {
            snippet: {
              liveChatId: this.vars.params.liveChatMessages.liveChatId,
              textMessageDetails: {
                messageText: this.utils.parse(text),
              },
              type: 'textMessageEvent',
            },
          }
        }).then(message => {
          data = message.data;

          console.log(data);

          return resolve({
            text: text,
            html: text,
            data,
          });
        }).catch(err => {
          console.log('ERROR', err);
          return this.error(err, false, reject);
        });
      });
    },

    /**************
    func: liveChatMessages
    params: packet
    describe: Return packet messages for a livechat id.
    ***************/
    liveChatMessages(packet) {
      return new Promise((resolve, reject) => {
        this.vars.params.liveChatMessages.liveChatId = packet.q.meta.params[1] || this.vars.params.liveChatMessages.liveChatId;
        this.vars.params.liveChatMessages.maxResuls = packet.q.meta.params[2] || this.vars.params.liveChatMessages.maxResults;

        if (packet.q.meta.params[3]) this.vars.params.liveChatMessages.pageToken = packet.q.meta.params[3];

        this.func._list('liveChatMessages', this.vars.params.liveChatMessages).then(messages => {
          this.vars.params.liveChatMessages.pageToken = messages.data.nextPageToken;
          return resolve({
            text: 'data',
            html: 'data',
            data: messages.data
          })
        }).catch(err => {
          return this.error(err, packet, reject);
        })
      });
    },

    /**************
    func: liveChatBan
    params: opts
    describe: this function will look at a defined list to block users in comments or live streams from polluting.
    ***************/
    liveChatBan(opts) {

    },

    setAuth() {
      return new Promise((resolve, reject) => {
        const {personal} = this.security();
        if (!personal) return resolve('NO SERVICE');
        try {
          const accts = Object.keys(personal);
          accts.forEach(a => {
            const acct = personal[a];

            this.prompt(a);
            this.modules[a] = []; // set the account into a module
            const authlen = acct.length;
            for (let x = 0; x < authlen; x++) {
              this.modules[a][x] = {};
              const {secret, token} = acct[x];
              this.modules[a][x].oAuth = new Oauth2(
                secret.installed.client_id,
                secret.installed.client_secret,
                secret.installed.redirect_uris[0]
              )
              this.modules[a][x].yt = google.youtube({
                version: 'v3',
                auth: this.modules[a][x].oAuth
              });
              this.modules[a][x].oAuth.setCredentials(token);
            }
          });
        }
        catch (err) {
          return this.error(err, false, reject);
        }
        finally {
          return resolve(this.vars.messages.auth);
        }
      });
    },

    help(text) {
      return this.lib.help(text, __dirname);
    },
  },
  methods: {
    /**************
    method:   comments
    params:   packet
    describe: Receive a request from the client to show comments for a specific
              video request from the Youtube API.
    ***************/
    comments(packet) {
      this.context('comments');
      return this.func.comments(packet.q)
    },

    /**************
    method:   replies
    params:   packet
    describe: Receive a request from the client to show comments for a specific
              video request from the Youtube API.
    ***************/
    replies(packet) {
      this.context('replies');
      return this.func.replies(packet.q)
    },

    /**************
    method:   comment
    params:   packet
    describe: Receive a packet from the client to send a comment to the
              Youtube API for a specific video.
    ***************/
    comment(packet) {
      this.context('comment');
      const {params} = packet.q.meta;
      if (params[1]) this.vars.params.comment.channelId = params[1];
      if (params[2]) this.vars.params.comment.videoId = params[2];

      // if params[3] then set the account to comment from.
      if (params[3]) {
        const opts = {
          key: params[3] || this.vars.acct.key,
          index: params[4] || this.vars.acct.index,
        }
        // if parameters set the account before sending to the function.
        return this.func.acct(opts).then(acct => {
          return this.func.comment(packet.q.text);
        });
      }
      else {
        return this.func.comment(packet.q.text);
      }
    },
    /**************
    method:   reply
    params:   packet
    describe: Reply to a specific comment over Youtube API.
    ***************/
    reply(packet) {
      this.context('reply');
      const {params} = packet.q.meta;
      if (params[1]) this.vars.params.reply.parentId = params[1];

      // if params[2] then set the account to comment from.
      if (params[2]) {
        const opts = {
          key: params[2] || this.vars.acct.key,
          index: params[3] || this.vars.acct.index,
        }
        // if parameters set the account before sending to the function.
        return this.func.acct(opts).then(acct => {
          return this.func.reply(packet.q.text);
        });
      }
      else {
        return this.func.reply(packet.q.text);
      }
    },

    /**************
    method:   playlist
    params:   packet
    describe: Request a playlist based on a passed in parameter id that returns
              video information from the Youtube API.
    ***************/
    playlist(packet) {
      this.context('playlist');
      let data = false;
      return new Promise((resolve, reject) => {
        if (!packet) return reject(this.vars.messages.packet);
        this.vars.params.playlist.playlistId = packet.q.text,
        this.func.playlist(this.vars.params.playlist).then(result => {
          data = result;
          const text = result.items.map(itm => {
            return [
              '::begin:video',
              `youtube:${itm.snippet.resourceId.videoId}`,
              `title: ${itm.snippet.title}`,
              `published: ${itm.snippet.publishedAt}`,
              `describe: ${itm.snippet.description.replace(/\n|\r/g, ' ')}`,
              '',
              `cmd[${this.vars.messages.labels.video}]:#youtube video ${itm.snippet.resourceId.videoId}`,
              `cmd[${this.vars.messages.labels.comments}]:#youtube comments:${itm.snippet.resourceId.videoId}`,
              '::end:video',
            ].join('\n')
          }).join('\n\n');
          return this.question(`#feecting parse:${this.agent().key}:playlist ${text}`);
        }).then(parsed => {
          return resolve({
            text: parsed.a.text,
            html: parsed.a.html,
            data,
          });
        }).catch(err => {
          return this.error(err, packet, reject);
        });
      });
    },

    /**************
    method:   channel
    params:   packet
    describe: Receive a packet from the client to request channel information
              from the Youtube API.
    ***************/
    channel(packet) {
      this.context('channel');
      return new Promise((resolve, reject) => {
        if (!packet) return reject(this.vars.messages.packet)
        let data = false;
        const channelId = packet && packet.q.text ? packet.q.text : false;
        this.func.channel(channelId).then(result => {
          data = result;
          const text = [
            '::begin:channel',
            `image: ${result.snippet.thumbnails.default.url}`,
            '::begin:details',
            `channel: ${result.snippet.title}`,
            `describe: ${result.snippet.description.replace(/\n|\r/g, ' ')}`,
            `country: ${result.snippet.country}`,
            `videos: ${result.statistics.videoCount}`,
            `views: ${result.statistics.viewCount}`,
            `subs: ${result.statistics.subscriberCount}`,
            '',
            `cmd[${this.vars.messages.labels.playlist}]:#youtube playlist ${result.contentDetails.relatedPlaylists.uploads}`,
            '::end:details',
            '::end:channel',
          ].join('\n\n');
          return this.question(`#feecting parse:${this.agent().key}:channel ${text}`);
        }).then(parsed => {
          return resolve({
            text: parsed.a.text,
            html: parsed.a.html,
            data,
          });
        }).catch(err => {
          return this.error(err, packet, reject);
        });
      });
    },

    /**************
    method:   search
    params:   packet
    describe: Receive a packet from the client to then send through the function
              to return search results from the Youtube API.
    ***************/
    search(packet) {
      this.context('search');
      // #youtubesearch max:order:
      return new Promise((resolve, reject) => {
        if (!packet) return reject(this.vars.messages.packet)

        let data = false;
        this.func.search({
          part: this.vars.params.search.part,
          q:packet.q.text,
          maxResults: packet.q.meta.params[1] || this.vars.params.search.maxResults,
          order: packet.q.meta.params[2] || this.vars.params.search.order,
          type: packet.q.meta.params[3] || this.vars.params.search.type,
          regionCode: packet.q.meta.params[5] || this.vars.params.search.region,
          relevanceLanguage: packet.q.meta.params[6] || this.vars.params.search.lang
        }).then(result => {
          data = result.items;
          let text = "NO RESULTS";
          if (data.length) text = result.items.map(itm => {
            return [
              '::begin:video',
              `youtube:${itm.id.videoId}`,
              '',
              `title: ${itm.snippet.title}`,
              `describe: ${itm.snippet.description.replace(/\n|\r/g, ' ')}`,
              `published: ${itm.snippet.publishedAt}`,
              `channel: ${itm.snippet.channelTitle}`,
              '',
              `button[${this.vars.messages.labels.video}]:#youtube video ${itm.id.videoId}`,
              `button[${this.vars.messages.labels.channel}]:#youtube channel ${itm.snippet.channelId}`,
              `button[${this.vars.messages.labels.comments}]:#youtube comments:${itm.id.videoId}`,
              '::end:video',
            ].join('\n');
          }).join('\n\n');
          return this.question(`#feecting parse:${this.agent().key}:search ${text}`);
        }).then(parsed => {
          return resolve({
            text: parsed.a.text,
            html: parsed.a.html,
            data,
          });
        }).catch(err => {
          return this.error(err, packet, reject);
        });
      });
    },

    /**************
    method:   streams
    params:   packet
    describe: Receive a packet with a text value to search Youtube streams
    ***************/
    streams(packet) {
      this.context('streams');
      return new Promise((resolve, reject) => {
        let data = false;

        this.func.search({
          part: this.vars.params.search.part,
          q: packet.q.text,
          maxResults: packet.q.meta.params[1] || this.vars.params.search.maxResuls,
          eventType: packet.q.meta.params[2] || this.vars.params.search.event,
          order: packet.q.meta.params[3] || this.vars.params.search.order,
          type: packet.q.meta.params[4] || this.vars.params.search.type,
          regionCode: packet.q.meta.params[5] || this.vars.params.search.region,
          relevanceLanguage: packet.q.meta.params[6] || this.vars.params.search.lang
        }).then(result => {
          data = result.items;
          const text = result.items.map(itm => {
            return [
              '::begin:video'
              `youtube:${itm.id.videoId}`,
              '',
              `title: ${itm.snippet.title}`,
              `describe: ${itm.snippet.description.replace(/\n|\r/g, ' ')}`,
              `published: ${itm.snippet.publishedAt}`,
              `channel: ${itm.snippet.channelTitle}`,
              '',
              `cmd[${this.vars.messages.labels.video}]:#youtube video ${itm.id.videoId}`,
              `cmd[${this.vars.messages.labels.channel}]:#youtube channel ${itm.snippet.channelId}`,
              `cmd[${this.vars.messages.labels.comments}]:#youtube comments:${itm.id.videoId}`,
              '::end:video',
            ].join('\n');
          }).join('\n\n');
          return this.question(`#feecting parse:${this.agent().key}:streams ${text}`);
        }).then(parsed => {
          return resolve({
            text: parsed.a.text,
            html: parsed.a.html,
            data,
          })
        }).catch(err => {
          return this.error(err, packet, reject);
        })

      });
    },


    stream(packet) {
      this.context('stream');
      return this.func.liveBroadcast(packet.q.meta.params[1])
    },

    /**************
    method:   messages
    params:   packet
    describe: Get the messages for a live stream and return them to the client.
    ***************/
    messages(packet) {
      this.context('messages');
      return this.func.liveChatMessages(packet);
    },

    /**************
    method:   chatid
    params:   packet
    describe: Receive a packet from the client which sets the livechat id that
              live stream chats will be sent to.
    ***************/
    chatid(packet) {
      this.context('chatid');
      if (packet.q.meta.params[1] === 'reset') {
        this.vars.params.liveChatMessages.liveChatId = false;
        return Promise.resolve({text:this.vars.messages.chatreset});
      }
      this.vars.params.liveChatMessages.liveChatId = packet.q.meta.params[1] || this.vars.params.liveChatMessages.liveChatId;
      return Promise.resolve({text:this.vars.messages.livechat});
    },

    /**************
    method:   chat
    params:   packet
    describe: Receive a packet from the client to send chat messages to a
              livestream over the Youtube API.

              The method will check for parameters to see if an account switch
              is necessary before sending a liveChat
    ***************/
    chat(packet) {
      this.context('chat');
      const {liveChatId} = this.vars.params.liveChatMessages;

      this.prompt(liveChatId);

      if (!liveChatId) return Promise.resolve({text:false});

      const {params} = packet.q.meta;

      if (params.length > 1) {
        const opts = {
          key: params[1] || this.vars.acct.key,
          index: params[2] || this.vars.acct.index,
        }
        // if parameters set the account before sending to the function.
        return this.func.acct(opts).then(acct => {
          this.prompt('live chat with acct');
          return this.func.liveChat(packet.q.text);
        });
      }
      else {
        this.prompt('live chat without acct');
        return this.func.liveChat(packet.q.text);
      }
    },

    /**************
    func: chats
    params: packet
    describe: retrieves a list of chat messages from youtube.
    ***************/
    chats(packet) {
      this.context('chats');
      const {liveChatId} = this.vars.params.liveChatMessages;
      if (!liveChatId) return Promise.resolve({text:false});
      return this.func.liveChatMessages(packet);
    },

    /**************
    method:   video
    params:   packet
    describe: Receive a request from the client to get the details of a video.
              Then the method will send the contents of packet.q.text to the
              videos function to retrieve data from the Youtube api.
    ***************/
    video(packet) {
      this.state('get');
      if (!packet) return Promise.reject(this.vars.messages.packet);
      this.action('func');
      return this.func.video(packet.q.text);
    },

    /**************
    method:   subscriptions
    params:   packet
    describe: receive a packet with parameters that contain a channel id then
              call the subscription function to get results from the youtube api.
    ***************/
    subs(packet) {
      this.context('subs');
      const {params} = packet.q.meta;
      let data = {};
      if (params[1]) {
        this.vars.params.subscriptions.mine = false;
        this.vars.params.subscriptions.channelId = params[1];
      }
      else {
        this.vars.params.subscriptions.mine = true;
        this.vars.params.subscriptions.channelId = false;
      }

      return new Promise((resolve, reject) => {
        this.func.subscriptions().then(results => {
          data = result.items;
          const text = result.items.map(itm => {
            return [
              '::begin:channel',
              `image: ${result.snippet.thumbnails.default.url}`,
              '::begin:details',
              `title: ${itm.snippet.title}`,
              `describe: ${itm.snippet.description.replace(/\n|\r/g, ' ')}`,
              `published: ${itm.snippet.publishedAt}`,
              '',
              `cmd[${this.vars.messages.labels.channel}]:#youtube channel ${itm.snippet.channelId}`,
              '::end:details',
              '::end:channel',
            ].join('\n');
          }).join('\n\n');
          return this.question(`#feecting parse:${this.agent().key}:subs ${text}`);
        }).then(parsed => {
          return resolve({
            text: parsed.a.text,
            html: parsed.a.html,
            data,
          })
        }).catch(err => {
          return this.error(err, packet, reject);
        });
      });
    },

    /**************
    method:   acct
    params:   packet params
    describe: Receive a packet from the client with parameters to set the
              necessary account to use when communicating with the Youtube api.
    ***************/
    acct(packet) {
      this.context('acct');
      const {params} = packet.q.meta;
      const key = params[1] || this.vars.acct.key;
      const index = params[2] || this.vars.acct.index;
      return this.func.acct({key,index});
    },

    /**************
    method:   rate
    params:   packet
    describe: Recieve a packet from the client to rate a video (like/dislike/none)
              then it will call the rate function to pass along the message to
              the Youtube api.
    ***************/
    rate(packet) {
      this.context('rate');
      return this.func.rate(packet.q);
    },
  },

  onError(err, packet, reject=false) {
    console.error(err);
    // if (err.response.data.error) {
    //   const {error} = err.response.data;
    //   const quota = error.errors.find(e => e.reason === this.vars.errors.quota) ? true : false;
    //   if (quota) {
    //     console.error('QUOTA LIMIT REACHED');
    //   }
    // }
    return reject ? reject(err) : false;
  },

  onDone() {
    this.func.setAuth().catch(err => {
      this.error(err);
    });
  },
});
module.exports = YOUTUBE
