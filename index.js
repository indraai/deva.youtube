// Copyright (c)2021 Quinn Michaels
// Youtube Deva
const fs = require('fs');
const path = require('path');

const {google} = require('googleapis');
const Oauth2 = google.auth.OAuth2;

const data_path = path.join(__dirname, 'data.json');
const {agent,vars} = require(data_path).data;

const Deva = require('@indra.ai/deva');
const YOUTUBE = new Deva({
  agent: {
    uid: agent.uid,
    key: agent.key,
    name: agent.name,
    describe: agent.describe,
    prompt: agent.prompt,
    voice: agent.voice,
    profile: agent.profile,
    translate(input) {
      return input.trim();
    },
    parse(input) {
      return input.trim();
    }
  },
  vars,
  listeners: {},
  modules: {
    oAuth: false,
    yt: false,
  },
  deva: {},
  func: {

    _insert(func, params) {
      return new Promise((resolve, reject) => {
        const {key, index} = this.vars.acct;
        this.modules[key][index].yt[func].insert(params, (err, response) => {
          if (err) return this.error(err, {func,params}, reject);
          this.vars.acct.index = index ? 0 : 1;
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
          const acct = this.client.services.youtube[opts.key][opts.index];
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
              `cmd[${labels.like}]:#youtube rate:${itm.id} like`,
              `cmd[${labels.comments}]:#youtube comments ${itm.id}`,
              `tty[${labels.comment}]:#youtube comment:${itm.snippet.channelId}:${itm.id} `,
              isLive ? `cmd[${labels.livechat}]:#youtube chatid:${itm.liveStreamingDetails.activeLiveChatId}` : '',
              '::end:buttons',
            ].join('\n');
          }).join('\n');
          return this.question(`#feecting parse:${this.agent.key}:video ${text}`);
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
    comments(packet) {
      if (packet.q.text) this.vars.params.comments.videoId = packet.q.text;
      if (packet.q.meta.params[1]) this.vars.params.comments.maxResults = packet.q.meta.params[1];
      return this.func._list('commentThreads', this.vars.params.comments);
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
                textOriginal: text,
              }
            }
          }
        }
      };

      return new Promise((resolve, reject) => {
        if (!params) return reject(this.vars.messages.params);
        this.func._insert('commentThreads', params).then(result => {
          return resolve(result.data);
        }).catch(err => {
          return this.error(err, text, reject);
        })
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
      return new Promise((resolve, reject) => {
        let data = {};
        if (!this.vars.params.liveChatMessages.liveChatId) return resolve({text:false})

        this.func._insert('liveChatMessages', {
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
                messageText: text,
              },
              type: 'textMessageEvent',
            },
          }
        }).then(message => {
          data = message.data;

          this.talk(`${this.agent.key}:chat`, {
            id:this.uid(),
            agent: this.agent,
            data: {
              key: this.vars.acct.key,
              text,
            },
            created: Date.now(),
          });

          const html = [
            '::begin:chat',
            text,
            '::end:chat',
          ].join('\n');
          return this.question(`#feecting parse:${this.agent.key}:chat ${text}`);
        }).then(parsed => {

          return resolve({
            text: parsed.a.text,
            html: parsed.a.html,
            data,
          });
        }).catch(err => {
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

    onStartLoad() {
      return new Promise((resolve, reject) => {
        const { channel, subscriptions, playlist } = this.func;
        // let's get our channel
        channel().then(ch => {
          this.agent.youtube = ch; // store in me for transport later
          this.vars.store.channel = ch;
          return subscriptions();
        }).then(subscr => {
          this.vars.store.subscriptions = subscr;
          return playlist({
            playlistId: this.vars.store.channel.contentDetails.relatedPlaylists.uploads,
            maxResults: this.vars.params.playlist.maxResuls,
            part: this.vars.params.playlist.part,
          });
        }).then(uploads => {
          this.vars.store.uploads = uploads;
          return resolve(true);
        }).catch(err => {
          return this.error(err, false, reject);
        });
      });
    },

    setAuth() {
      return new Promise((resolve, reject) => {
        if (!this.client.services.youtube) return resolve('NO SERVICE');
        try {
          const auth = this.client.services.youtube;
          const accts = Object.keys(auth);
          accts.forEach(a => {
            const acct = auth[a];

            this.prompt(`Auth ${a}`);

            this.modules[a] = [];
            const authlen = auth[a].length
            for (let x = 0; x < authlen; x++) {
              this.modules[a][x] = {};
              const {secret, token} = auth[a][x];
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
      return new Promise((resolve, reject) => {
        if (!packet) return reject(this.vars.messages.packet);
        let data = false;
        this.func.comments(packet).then(result => {
          data = result.data.items;
          const text = result.data.items.map(itm => {
            return [
              `::begin:comment`,
              `avatar: ${itm.snippet.topLevelComment.snippet.authorProfileImageUrl}\r`,
              `::begin:details`,
              `author: ${itm.snippet.topLevelComment.snippet.authorDisplayName}\r`,
              `describe: ${itm.snippet.topLevelComment.snippet.textOriginal.replace(/\n|\r/g, ' ')}\r`,
              `published: ${itm.snippet.topLevelComment.snippet.publishedAt}\r`,
              `likes: ${itm.snippet.topLevelComment.snippet.likeCount}\r`,
              `::end:details`,
              `::end:comment`,
            ].join('\n');
          }).join('\n');
          return this.question(`#feecting parse:${this.agent.key}:comments ${text}`);
        }).then(parsed => {
          return resolve({
            text: parsed.a.text,
            html: parsed.a.html,
            data
          });
        }).catch(err => {
          return this.error(err, packet, reject);
        })
      });
    },

    /**************
    method:   comment
    params:   packet
    describe: Receive a packet from the client to send a comment to the
              Youtube API for a specific video.
    ***************/
    comment(packet) {
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
    method:   playlist
    params:   packet
    describe: Request a playlist based on a passed in parameter id that returns
              video information from the Youtube API.
    ***************/
    playlist(packet) {
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
              `cmd[${this.vars.messages.labels.comments}]:#youtube comments ${itm.snippet.resourceId.videoId}`,
              '::end:video',
            ].join('\n')
          }).join('\n\n');
          return this.question(`#feecting parse:${this.agent.key}:playlist ${text}`);
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
          return this.question(`#feecting parse:${this.agent.key}:channel ${text}`);
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
          const text = result.items.map(itm => {
            return [
              '::begin:video',
              `youtube:${itm.id.videoId}`,
              '',
              `title: ${itm.snippet.title}`,
              `describe: ${itm.snippet.description.replace(/\n|\r/g, ' ')}`,
              `published: ${itm.snippet.publishedAt}`,
              `channel: ${itm.snippet.channelTitle}`,
              '',
              `cmd[${this.vars.messages.labels.video}]:#youtube video ${itm.id.videoId}`,
              `cmd[${this.vars.messages.labels.channel}]:#youtube channel ${itm.snippet.channelId}`,
              `cmd[${this.vars.messages.labels.comments}]:#youtube comments ${itm.id.videoId}`,
              '::end:video',
            ].join('\n');
          }).join('\n\n');
          return this.question(`#feecting parse:${this.agent.key}:search ${text}`);
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
              `cmd[${this.vars.messages.labels.comments}]:#youtube comments ${itm.id.videoId}`,
              '::end:video',
            ].join('\n');
          }).join('\n\n');
          return this.question(`#feecting parse:${this.agent.key}:streams ${text}`);
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
      return this.func.liveBroadcast(packet.q.meta.params[1])
    },

    /**************
    method:   messages
    params:   packet
    describe: Get the messages for a live stream and return them to the client.
    ***************/
    messages(packet) {
      return this.func.liveChatMessages(packet);
    },

    /**************
    method:   chatid
    params:   packet
    describe: Receive a packet from the client which sets the livechat id that
              live stream chats will be sent to.
    ***************/
    chatid(packet) {
      if (packet.q.meta.params[1] === 'reset') {
        this.vars.params.liveChatMessages.liveChatId = false;
        return Promise.resolve({text:this.vars.messages.chatreset});
      }
      this.vars.params.liveChatMessages.liveChatId = packet.q.meta.params[1] || this.vars.params.liveChatMessages.liveChatId;
      return Promise.resolve({text:this.vars.messages.livechatid});
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
      const {liveChatId} = this.vars.params.liveChatMessages;
      if (!liveChatId) return Promise.resolve({text:false});

      const {params} = packet.q.meta;

      if (params.length) {
        const opts = {
          key: params[1] || this.vars.acct.key,
          index: params[2] || this.vars.acct.index,
        }
        // if parameters set the account before sending to the function.
        return this.func.acct(opts).then(acct => {
          return this.func.liveChat(packet.q.text);
        });
      }
      else {
        return this.func.liveChat(packet.q.text);
      }
    },

    /**************
    func: chats
    params: packet
    describe: retrieves a list of chat messages from youtube.
    ***************/
    chats(packet) {
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
      if (!packet) return Promise.reject(this.vars.messages.packet);
      return this.func.video(packet.q.text);
    },

    /**************
    method:   subscriptions
    params:   packet
    describe: receive a packet with parameters that contain a channel id then
              call the subscription function to get results from the youtube api.
    ***************/
    subs(packet) {
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
          return this.question(`#feecting parse:${this.agent.key}:subs ${text}`);
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
    method:   uid
    params:   none
    describe: geneate a uid and deliver it back to the client.
    ***************/
    uid() {
      return Promise.resolve(this.uid());
    },

    /**************
    method:   status
    params:   none
    describe: return the status of the current agent/deva to the client
    ***************/
    status() {
      return this.status();
    },

    /**************
    method:   acct
    params:   packet params
    describe: Receive a packet from the client with parameters to set the
              necessary account to use when communicating with the Youtube api.
    ***************/
    acct(packet) {
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
      return this.func.rate(packet.q);
    },

    help(packet) {
      return new Promise((resolve, reject) => {
        this.lib.help(packet.q.text, __dirname).then(text => {
          return resolve({text})
        }).catch(err => {
          return this.error(err, packet, reject);
        });
      });
    }
  },

  onError(err, packet, reject=false) {
    console.error(err);
    if (err.response.data.error) {
      const {error} = err.response.data;
      const quota = error.errors.find(e => e.reason === this.vars.errors.quota) ? true : false;
      if (quota) {
        console.error('QUOTA LIMIT REACHED');
      }
    }
    return reject ? reject(err) : false;
  },

  onInit() {
    if (this.client.services.youtube) this.func.setAuth().then(auth => {
      return this.func.onStartLoad(auth);
    }).then(started => {
      this.prompt(this.vars.messages.init);
      return this.start();
    }).catch(err => {
      return this.error(err);
    });
  },
});
module.exports = YOUTUBE
