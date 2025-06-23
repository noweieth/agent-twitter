'use strict';

var toughCookie = require('tough-cookie');
var setCookie = require('set-cookie-parser');
var headersPolyfill = require('headers-polyfill');
var twitterApiV2 = require('twitter-api-v2');
var typebox = require('@sinclair/typebox');
var value = require('@sinclair/typebox/value');
var OTPAuth = require('otpauth');
var stringify = require('json-stable-stringify');
var events = require('events');
var WebSocket = require('ws');
var wrtc = require('@roamhq/wrtc');
var fs = require('fs');
var path = require('path');
var child_process = require('child_process');

function _interopNamespaceDefault(e) {
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var OTPAuth__namespace = /*#__PURE__*/_interopNamespaceDefault(OTPAuth);
var fs__namespace = /*#__PURE__*/_interopNamespaceDefault(fs);

class ApiError extends Error {
  constructor(response, data, message) {
    super(message);
    this.response = response;
    this.data = data;
  }
  static async fromResponse(response) {
    let data = void 0;
    try {
      data = await response.json();
    } catch {
      try {
        data = await response.text();
      } catch {
      }
    }
    return new ApiError(response, data, `Response status: ${response.status}`);
  }
}

const genericPlatform = new class {
  randomizeCiphers() {
    return Promise.resolve();
  }
}();

class Platform {
  async randomizeCiphers() {
    const platform = await Platform.importPlatform();
    await platform?.randomizeCiphers();
  }
  static async importPlatform() {
    return genericPlatform;
  }
}

async function updateCookieJar(cookieJar, headers) {
  const setCookieHeader = headers.get("set-cookie");
  if (setCookieHeader) {
    const cookies = setCookie.splitCookiesString(setCookieHeader);
    for (const cookie of cookies.map((c) => toughCookie.Cookie.parse(c))) {
      if (!cookie) continue;
      await cookieJar.setCookie(
        cookie,
        `${cookie.secure ? "https" : "http"}://${cookie.domain}${cookie.path}`
      );
    }
  } else if (typeof document !== "undefined") {
    for (const cookie of document.cookie.split(";")) {
      const hardCookie = toughCookie.Cookie.parse(cookie);
      if (hardCookie) {
        await cookieJar.setCookie(hardCookie, document.location.toString());
      }
    }
  }
}

const bearerToken = "AAAAAAAAAAAAAAAAAAAAAFQODgEAAAAAVHTp76lzh3rFzcHbmHVvQxYYpTw%3DckAlMINMjmCwxUcaXbAN4XqJVdgMJaHqNOFgPMK0zN1qLqLQCF";
async function requestApi(url, auth, method = "GET", platform = new Platform(), body) {
  const headers = new headersPolyfill.Headers();
  await auth.installTo(headers, url);
  await platform.randomizeCiphers();
  let res;
  do {
    try {
      res = await auth.fetch(url, {
        method,
        headers,
        credentials: "include",
        ...body && { body: JSON.stringify(body) }
      });
    } catch (err) {
      if (!(err instanceof Error)) {
        throw err;
      }
      return {
        success: false,
        err: new Error("Failed to perform request.")
      };
    }
    await updateCookieJar(auth.cookieJar(), res.headers);
    if (res.status === 429) {
      const xRateLimitRemaining = res.headers.get("x-rate-limit-remaining");
      const xRateLimitReset = res.headers.get("x-rate-limit-reset");
      if (xRateLimitRemaining == "0" && xRateLimitReset) {
        const currentTime = (/* @__PURE__ */ new Date()).valueOf() / 1e3;
        const timeDeltaMs = 1e3 * (parseInt(xRateLimitReset) - currentTime);
        await new Promise((resolve) => setTimeout(resolve, timeDeltaMs));
      }
    }
  } while (res.status === 429);
  if (!res.ok) {
    return {
      success: false,
      err: await ApiError.fromResponse(res)
    };
  }
  const transferEncoding = res.headers.get("transfer-encoding");
  if (transferEncoding === "chunked") {
    const reader = typeof res.body?.getReader === "function" ? res.body.getReader() : null;
    if (!reader) {
      try {
        const text = await res.text();
        try {
          const value = JSON.parse(text);
          return { success: true, value };
        } catch (e) {
          return { success: true, value: { text } };
        }
      } catch (e) {
        return {
          success: false,
          err: new Error("No readable stream available and cant parse")
        };
      }
    }
    let chunks = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks += new TextDecoder().decode(value);
    }
    try {
      const value = JSON.parse(chunks);
      return { success: true, value };
    } catch (e) {
      return { success: true, value: { text: chunks } };
    }
  }
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const value = await res.json();
    if (res.headers.get("x-rate-limit-incoming") == "0") {
      auth.deleteToken();
    }
    return { success: true, value };
  }
  return { success: true, value: {} };
}
function addApiFeatures(o) {
  return {
    ...o,
    rweb_lists_timeline_redesign_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    tweetypie_unmention_optimization_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    longform_notetweets_rich_text_read_enabled: true,
    responsive_web_enhance_cards_enabled: false,
    subscriptions_verification_info_enabled: true,
    subscriptions_verification_info_reason_enabled: true,
    subscriptions_verification_info_verified_since_enabled: true,
    super_follow_badge_privacy_enabled: false,
    super_follow_exclusive_tweet_notifications_enabled: false,
    super_follow_tweet_api_enabled: false,
    super_follow_user_api_enabled: false,
    android_graphql_skip_api_media_color_palette: false,
    creator_subscriptions_subscription_count_enabled: false,
    blue_business_profile_image_shape_enabled: false,
    unified_cards_ad_metadata_container_dynamic_card_content_query_enabled: false
  };
}
function addApiParams(params, includeTweetReplies) {
  params.set("include_profile_interstitial_type", "1");
  params.set("include_blocking", "1");
  params.set("include_blocked_by", "1");
  params.set("include_followed_by", "1");
  params.set("include_want_retweets", "1");
  params.set("include_mute_edge", "1");
  params.set("include_can_dm", "1");
  params.set("include_can_media_tag", "1");
  params.set("include_ext_has_nft_avatar", "1");
  params.set("include_ext_is_blue_verified", "1");
  params.set("include_ext_verified_type", "1");
  params.set("skip_status", "1");
  params.set("cards_platform", "Web-12");
  params.set("include_cards", "1");
  params.set("include_ext_alt_text", "true");
  params.set("include_ext_limited_action_results", "false");
  params.set("include_quote_count", "true");
  params.set("include_reply_count", "1");
  params.set("tweet_mode", "extended");
  params.set("include_ext_collab_control", "true");
  params.set("include_ext_views", "true");
  params.set("include_entities", "true");
  params.set("include_user_entities", "true");
  params.set("include_ext_media_color", "true");
  params.set("include_ext_media_availability", "true");
  params.set("include_ext_sensitive_media_warning", "true");
  params.set("include_ext_trusted_friends_metadata", "true");
  params.set("send_error_codes", "true");
  params.set("simple_quoted_tweet", "true");
  params.set("include_tweet_replies", `${includeTweetReplies}`);
  params.set(
    "ext",
    "mediaStats,highlightedLabel,hasNftAvatar,voiceInfo,birdwatchPivot,enrichments,superFollowMetadata,unmentionInfo,editControl,collab_control,vibe"
  );
  return params;
}

function withTransform(fetchFn, transform) {
  return async (input, init) => {
    const fetchArgs = await transform?.request?.(input, init) ?? [
      input,
      init
    ];
    const res = await fetchFn(...fetchArgs);
    return await transform?.response?.(res) ?? res;
  };
}
class TwitterGuestAuth {
  constructor(bearerToken, options) {
    this.options = options;
    this.fetch = withTransform(options?.fetch ?? fetch, options?.transform);
    this.bearerToken = bearerToken;
    this.jar = new toughCookie.CookieJar();
    this.v2Client = null;
  }
  cookieJar() {
    return this.jar;
  }
  getV2Client() {
    return this.v2Client ?? null;
  }
  loginWithV2(appKey, appSecret, accessToken, accessSecret) {
    const v2Client = new twitterApiV2.TwitterApi({
      appKey,
      appSecret,
      accessToken,
      accessSecret
    });
    this.v2Client = v2Client;
  }
  isLoggedIn() {
    return Promise.resolve(false);
  }
  async me() {
    return void 0;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  login(_username, _password, _email) {
    return this.updateGuestToken();
  }
  logout() {
    this.deleteToken();
    this.jar = new toughCookie.CookieJar();
    return Promise.resolve();
  }
  deleteToken() {
    delete this.guestToken;
    delete this.guestCreatedAt;
  }
  hasToken() {
    return this.guestToken != null;
  }
  authenticatedAt() {
    if (this.guestCreatedAt == null) {
      return null;
    }
    return new Date(this.guestCreatedAt);
  }
  async installTo(headers) {
    if (this.shouldUpdate()) {
      await this.updateGuestToken();
    }
    const token = this.guestToken;
    if (token == null) {
      throw new Error("Authentication token is null or undefined.");
    }
    headers.set("authorization", `Bearer ${this.bearerToken}`);
    headers.set("x-guest-token", token);
    const cookies = await this.getCookies();
    const xCsrfToken = cookies.find((cookie) => cookie.key === "ct0");
    if (xCsrfToken) {
      headers.set("x-csrf-token", xCsrfToken.value);
    }
    headers.set("cookie", await this.getCookieString());
  }
  getCookies() {
    return this.jar.getCookies(this.getCookieJarUrl());
  }
  getCookieString() {
    return this.jar.getCookieString(this.getCookieJarUrl());
  }
  async removeCookie(key) {
    const store = this.jar.store;
    const cookies = await this.jar.getCookies(this.getCookieJarUrl());
    for (const cookie of cookies) {
      if (!cookie.domain || !cookie.path) continue;
      store.removeCookie(cookie.domain, cookie.path, key);
      if (typeof document !== "undefined") {
        document.cookie = `${cookie.key}=; Max-Age=0; path=${cookie.path}; domain=${cookie.domain}`;
      }
    }
  }
  getCookieJarUrl() {
    return typeof document !== "undefined" ? document.location.toString() : "https://twitter.com";
  }
  /**
   * Updates the authentication state with a new guest token from the Twitter API.
   */
  async updateGuestToken() {
    const guestActivateUrl = "https://api.twitter.com/1.1/guest/activate.json";
    const headers = new headersPolyfill.Headers({
      Authorization: `Bearer ${this.bearerToken}`,
      Cookie: await this.getCookieString()
    });
    const res = await this.fetch(guestActivateUrl, {
      method: "POST",
      headers,
      referrerPolicy: "no-referrer"
    });
    await updateCookieJar(this.jar, res.headers);
    if (!res.ok) {
      throw new Error(await res.text());
    }
    const o = await res.json();
    if (o == null || o["guest_token"] == null) {
      throw new Error("guest_token not found.");
    }
    const newGuestToken = o["guest_token"];
    if (typeof newGuestToken !== "string") {
      throw new Error("guest_token was not a string.");
    }
    this.guestToken = newGuestToken;
    this.guestCreatedAt = /* @__PURE__ */ new Date();
  }
  /**
   * Returns if the authentication token needs to be updated or not.
   * @returns `true` if the token needs to be updated; `false` otherwise.
   */
  shouldUpdate() {
    return !this.hasToken() || this.guestCreatedAt != null && this.guestCreatedAt < new Date((/* @__PURE__ */ new Date()).valueOf() - 3 * 60 * 60 * 1e3);
  }
}

function getAvatarOriginalSizeUrl(avatarUrl) {
  return avatarUrl ? avatarUrl.replace("_normal", "") : void 0;
}
function parseProfile(user, isBlueVerified) {
  const profile = {
    avatar: getAvatarOriginalSizeUrl(user.profile_image_url_https),
    banner: user.profile_banner_url,
    biography: user.description,
    followersCount: user.followers_count,
    followingCount: user.friends_count,
    friendsCount: user.friends_count,
    mediaCount: user.media_count,
    isPrivate: user.protected ?? false,
    isVerified: user.verified,
    likesCount: user.favourites_count,
    listedCount: user.listed_count,
    location: user.location,
    name: user.name,
    pinnedTweetIds: user.pinned_tweet_ids_str,
    tweetsCount: user.statuses_count,
    url: `https://twitter.com/${user.screen_name}`,
    userId: user.id_str,
    username: user.screen_name,
    isBlueVerified: isBlueVerified ?? false,
    canDm: user.can_dm
  };
  if (user.created_at != null) {
    profile.joined = new Date(Date.parse(user.created_at));
  }
  const urls = user.entities?.url?.urls;
  if (urls?.length != null && urls?.length > 0) {
    profile.website = urls[0].expanded_url;
  }
  return profile;
}
async function getProfile(username, auth) {
  const params = new URLSearchParams();
  params.set(
    "variables",
    stringify({
      screen_name: username,
      withSafetyModeUserFields: true
    }) ?? ""
  );
  params.set(
    "features",
    stringify({
      hidden_profile_likes_enabled: false,
      hidden_profile_subscriptions_enabled: false,
      // Auth-restricted
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: false,
      subscriptions_verification_info_is_identity_verified_enabled: false,
      subscriptions_verification_info_verified_since_enabled: true,
      highlights_tweets_tab_ui_enabled: true,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      responsive_web_graphql_timeline_navigation_enabled: true
    }) ?? ""
  );
  params.set("fieldToggles", stringify({ withAuxiliaryUserLabels: false }) ?? "");
  const res = await requestApi(
    `https://twitter.com/i/api/graphql/G3KGOASz96M-Qu0nwmGXNg/UserByScreenName?${params.toString()}`,
    auth
  );
  if (!res.success) {
    return res;
  }
  const { value } = res;
  const { errors } = value;
  if (errors != null && errors.length > 0) {
    return {
      success: false,
      err: new Error(errors[0].message)
    };
  }
  if (!value.data || !value.data.user || !value.data.user.result) {
    return {
      success: false,
      err: new Error("User not found.")
    };
  }
  const { result: user } = value.data.user;
  const { legacy } = user;
  if (user.rest_id == null || user.rest_id.length === 0) {
    return {
      success: false,
      err: new Error("rest_id not found.")
    };
  }
  legacy.id_str = user.rest_id;
  if (legacy.screen_name == null || legacy.screen_name.length === 0) {
    return {
      success: false,
      err: new Error(`Either ${username} does not exist or is private.`)
    };
  }
  return {
    success: true,
    value: parseProfile(user.legacy, user.is_blue_verified)
  };
}
const idCache = /* @__PURE__ */ new Map();
async function getScreenNameByUserId(userId, auth) {
  const params = new URLSearchParams();
  params.set(
    "variables",
    stringify({
      userId,
      withSafetyModeUserFields: true
    }) ?? ""
  );
  params.set(
    "features",
    stringify({
      hidden_profile_subscriptions_enabled: true,
      rweb_tipjar_consumption_enabled: true,
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: false,
      highlights_tweets_tab_ui_enabled: true,
      responsive_web_twitter_article_notes_tab_enabled: true,
      subscriptions_feature_can_gift_premium: false,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      responsive_web_graphql_timeline_navigation_enabled: true
    }) ?? ""
  );
  const res = await requestApi(
    `https://twitter.com/i/api/graphql/xf3jd90KKBCUxdlI_tNHZw/UserByRestId?${params.toString()}`,
    auth
  );
  if (!res.success) {
    return res;
  }
  const { value } = res;
  const { errors } = value;
  if (errors != null && errors.length > 0) {
    return {
      success: false,
      err: new Error(errors[0].message)
    };
  }
  if (!value.data || !value.data.user || !value.data.user.result) {
    return {
      success: false,
      err: new Error("User not found.")
    };
  }
  const { result: user } = value.data.user;
  const { legacy } = user;
  if (legacy.screen_name == null || legacy.screen_name.length === 0) {
    return {
      success: false,
      err: new Error(
        `Either user with ID ${userId} does not exist or is private.`
      )
    };
  }
  return {
    success: true,
    value: legacy.screen_name
  };
}
async function getUserIdByScreenName(screenName, auth) {
  const cached = idCache.get(screenName);
  if (cached != null) {
    return { success: true, value: cached };
  }
  const profileRes = await getProfile(screenName, auth);
  if (!profileRes.success) {
    return profileRes;
  }
  const profile = profileRes.value;
  if (profile.userId != null) {
    idCache.set(screenName, profile.userId);
    return {
      success: true,
      value: profile.userId
    };
  }
  return {
    success: false,
    err: new Error("User ID is undefined.")
  };
}

const TwitterUserAuthSubtask = typebox.Type.Object({
  subtask_id: typebox.Type.String(),
  enter_text: typebox.Type.Optional(typebox.Type.Object({}))
});
class TwitterUserAuth extends TwitterGuestAuth {
  constructor(bearerToken, options) {
    super(bearerToken, options);
  }
  async isLoggedIn() {
    const res = await requestApi(
      "https://api.twitter.com/1.1/account/verify_credentials.json",
      this
    );
    if (!res.success) {
      return false;
    }
    const { value: verify } = res;
    this.userProfile = parseProfile(
      verify,
      verify.verified
    );
    return verify && !verify.errors?.length;
  }
  async me() {
    if (this.userProfile) {
      return this.userProfile;
    }
    await this.isLoggedIn();
    return this.userProfile;
  }
  async login(username, password, email, twoFactorSecret, appKey, appSecret, accessToken, accessSecret) {
    await this.updateGuestToken();
    let next = await this.initLogin();
    while ("subtask" in next && next.subtask) {
      if (next.subtask.subtask_id === "LoginJsInstrumentationSubtask") {
        next = await this.handleJsInstrumentationSubtask(next);
      } else if (next.subtask.subtask_id === "LoginEnterUserIdentifierSSO") {
        next = await this.handleEnterUserIdentifierSSO(next, username);
      } else if (next.subtask.subtask_id === "LoginEnterAlternateIdentifierSubtask") {
        next = await this.handleEnterAlternateIdentifierSubtask(
          next,
          email
        );
      } else if (next.subtask.subtask_id === "LoginEnterPassword") {
        next = await this.handleEnterPassword(next, password);
      } else if (next.subtask.subtask_id === "AccountDuplicationCheck") {
        next = await this.handleAccountDuplicationCheck(next);
      } else if (next.subtask.subtask_id === "LoginTwoFactorAuthChallenge") {
        if (twoFactorSecret) {
          next = await this.handleTwoFactorAuthChallenge(next, twoFactorSecret);
        } else {
          throw new Error(
            "Requested two factor authentication code but no secret provided"
          );
        }
      } else if (next.subtask.subtask_id === "LoginAcid") {
        next = await this.handleAcid(next, email);
      } else if (next.subtask.subtask_id === "LoginSuccessSubtask") {
        next = await this.handleSuccessSubtask(next);
      } else {
        throw new Error(`Unknown subtask ${next.subtask.subtask_id}`);
      }
    }
    if (appKey && appSecret && accessToken && accessSecret) {
      this.loginWithV2(appKey, appSecret, accessToken, accessSecret);
    }
    if ("err" in next) {
      throw next.err;
    }
  }
  async logout() {
    if (!this.isLoggedIn()) {
      return;
    }
    await requestApi(
      "https://api.twitter.com/1.1/account/logout.json",
      this,
      "POST"
    );
    this.deleteToken();
    this.jar = new toughCookie.CookieJar();
  }
  async installCsrfToken(headers) {
    const cookies = await this.getCookies();
    const xCsrfToken = cookies.find((cookie) => cookie.key === "ct0");
    if (xCsrfToken) {
      headers.set("x-csrf-token", xCsrfToken.value);
    }
  }
  async installTo(headers) {
    headers.set("authorization", `Bearer ${this.bearerToken}`);
    headers.set("cookie", await this.getCookieString());
    await this.installCsrfToken(headers);
  }
  async initLogin() {
    this.removeCookie("twitter_ads_id=");
    this.removeCookie("ads_prefs=");
    this.removeCookie("_twitter_sess=");
    this.removeCookie("zipbox_forms_auth_token=");
    this.removeCookie("lang=");
    this.removeCookie("bouncer_reset_cookie=");
    this.removeCookie("twid=");
    this.removeCookie("twitter_ads_idb=");
    this.removeCookie("email_uid=");
    this.removeCookie("external_referer=");
    this.removeCookie("ct0=");
    this.removeCookie("aa_u=");
    return await this.executeFlowTask({
      flow_name: "login",
      input_flow_data: {
        flow_context: {
          debug_overrides: {},
          start_location: {
            location: "splash_screen"
          }
        }
      }
    });
  }
  async handleJsInstrumentationSubtask(prev) {
    return await this.executeFlowTask({
      flow_token: prev.flowToken,
      subtask_inputs: [
        {
          subtask_id: "LoginJsInstrumentationSubtask",
          js_instrumentation: {
            response: "{}",
            link: "next_link"
          }
        }
      ]
    });
  }
  async handleEnterAlternateIdentifierSubtask(prev, email) {
    return await this.executeFlowTask({
      flow_token: prev.flowToken,
      subtask_inputs: [
        {
          subtask_id: "LoginEnterAlternateIdentifierSubtask",
          enter_text: {
            text: email,
            link: "next_link"
          }
        }
      ]
    });
  }
  async handleEnterUserIdentifierSSO(prev, username) {
    return await this.executeFlowTask({
      flow_token: prev.flowToken,
      subtask_inputs: [
        {
          subtask_id: "LoginEnterUserIdentifierSSO",
          settings_list: {
            setting_responses: [
              {
                key: "user_identifier",
                response_data: {
                  text_data: { result: username }
                }
              }
            ],
            link: "next_link"
          }
        }
      ]
    });
  }
  async handleEnterPassword(prev, password) {
    return await this.executeFlowTask({
      flow_token: prev.flowToken,
      subtask_inputs: [
        {
          subtask_id: "LoginEnterPassword",
          enter_password: {
            password,
            link: "next_link"
          }
        }
      ]
    });
  }
  async handleAccountDuplicationCheck(prev) {
    return await this.executeFlowTask({
      flow_token: prev.flowToken,
      subtask_inputs: [
        {
          subtask_id: "AccountDuplicationCheck",
          check_logged_in_account: {
            link: "AccountDuplicationCheck_false"
          }
        }
      ]
    });
  }
  async handleTwoFactorAuthChallenge(prev, secret) {
    const totp = new OTPAuth__namespace.TOTP({ secret });
    let error;
    for (let attempts = 1; attempts < 4; attempts += 1) {
      try {
        return await this.executeFlowTask({
          flow_token: prev.flowToken,
          subtask_inputs: [
            {
              subtask_id: "LoginTwoFactorAuthChallenge",
              enter_text: {
                link: "next_link",
                text: totp.generate()
              }
            }
          ]
        });
      } catch (err) {
        error = err;
        await new Promise((resolve) => setTimeout(resolve, 2e3 * attempts));
      }
    }
    throw error;
  }
  async handleAcid(prev, email) {
    return await this.executeFlowTask({
      flow_token: prev.flowToken,
      subtask_inputs: [
        {
          subtask_id: "LoginAcid",
          enter_text: {
            text: email,
            link: "next_link"
          }
        }
      ]
    });
  }
  async handleSuccessSubtask(prev) {
    return await this.executeFlowTask({
      flow_token: prev.flowToken,
      subtask_inputs: []
    });
  }
  async executeFlowTask(data) {
    const onboardingTaskUrl = "https://api.twitter.com/1.1/onboarding/task.json";
    const token = this.guestToken;
    if (token == null) {
      throw new Error("Authentication token is null or undefined.");
    }
    const headers = new headersPolyfill.Headers({
      authorization: `Bearer ${this.bearerToken}`,
      cookie: await this.getCookieString(),
      "content-type": "application/json",
      "User-Agent": "Mozilla/5.0 (Linux; Android 11; Nokia G20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.88 Mobile Safari/537.36",
      "x-guest-token": token,
      "x-twitter-auth-type": "OAuth2Client",
      "x-twitter-active-user": "yes",
      "x-twitter-client-language": "en"
    });
    await this.installCsrfToken(headers);
    const res = await this.fetch(onboardingTaskUrl, {
      credentials: "include",
      method: "POST",
      headers,
      body: JSON.stringify(data)
    });
    await updateCookieJar(this.jar, res.headers);
    if (!res.ok) {
      return { status: "error", err: new Error(await res.text()) };
    }
    const flow = await res.json();
    if (flow?.flow_token == null) {
      return { status: "error", err: new Error("flow_token not found.") };
    }
    if (flow.errors?.length) {
      return {
        status: "error",
        err: new Error(
          `Authentication error (${flow.errors[0].code}): ${flow.errors[0].message}`
        )
      };
    }
    if (typeof flow.flow_token !== "string") {
      return {
        status: "error",
        err: new Error("flow_token was not a string.")
      };
    }
    const subtask = flow.subtasks?.length ? flow.subtasks[0] : void 0;
    value.Check(TwitterUserAuthSubtask, subtask);
    if (subtask && subtask.subtask_id === "DenyLoginSubtask") {
      return {
        status: "error",
        err: new Error("Authentication error: DenyLoginSubtask")
      };
    }
    return {
      status: "success",
      subtask,
      flowToken: flow.flow_token
    };
  }
}

async function* getUserTimeline(query, maxProfiles, fetchFunc) {
  let nProfiles = 0;
  let cursor = void 0;
  let consecutiveEmptyBatches = 0;
  while (nProfiles < maxProfiles) {
    const batch = await fetchFunc(
      query,
      maxProfiles,
      cursor
    );
    const { profiles, next } = batch;
    cursor = next;
    if (profiles.length === 0) {
      consecutiveEmptyBatches++;
      if (consecutiveEmptyBatches > 5) break;
    } else consecutiveEmptyBatches = 0;
    for (const profile of profiles) {
      if (nProfiles < maxProfiles) yield profile;
      else break;
      nProfiles++;
    }
    if (!next) break;
  }
}
async function* getTweetTimeline(query, maxTweets, fetchFunc) {
  let nTweets = 0;
  let cursor = void 0;
  while (nTweets < maxTweets) {
    const batch = await fetchFunc(
      query,
      maxTweets,
      cursor
    );
    const { tweets, next } = batch;
    if (tweets.length === 0) {
      break;
    }
    for (const tweet of tweets) {
      if (nTweets < maxTweets) {
        cursor = next;
        yield tweet;
      } else {
        break;
      }
      nTweets++;
    }
  }
}

function isFieldDefined(key) {
  return function(value) {
    return isDefined(value[key]);
  };
}
function isDefined(value) {
  return value != null;
}

const reHashtag = /\B(\#\S+\b)/g;
const reCashtag = /\B(\$\S+\b)/g;
const reTwitterUrl = /https:(\/\/t\.co\/([A-Za-z0-9]|[A-Za-z]){10})/g;
const reUsername = /\B(\@\S{1,15}\b)/g;
function parseMediaGroups(media) {
  const photos = [];
  const videos = [];
  let sensitiveContent = void 0;
  for (const m of media.filter(isFieldDefined("id_str")).filter(isFieldDefined("media_url_https"))) {
    if (m.type === "photo") {
      photos.push({
        id: m.id_str,
        url: m.media_url_https,
        alt_text: m.ext_alt_text
      });
    } else if (m.type === "video") {
      videos.push(parseVideo(m));
    }
    const sensitive = m.ext_sensitive_media_warning;
    if (sensitive != null) {
      sensitiveContent = sensitive.adult_content || sensitive.graphic_violence || sensitive.other;
    }
  }
  return { sensitiveContent, photos, videos };
}
function parseVideo(m) {
  const video = {
    id: m.id_str,
    preview: m.media_url_https
  };
  let maxBitrate = 0;
  const variants = m.video_info?.variants ?? [];
  for (const variant of variants) {
    const bitrate = variant.bitrate;
    if (bitrate != null && bitrate > maxBitrate && variant.url != null) {
      let variantUrl = variant.url;
      const stringStart = 0;
      const tagSuffixIdx = variantUrl.indexOf("?tag=10");
      if (tagSuffixIdx !== -1) {
        variantUrl = variantUrl.substring(stringStart, tagSuffixIdx + 1);
      }
      video.url = variantUrl;
      maxBitrate = bitrate;
    }
  }
  return video;
}
function reconstructTweetHtml(tweet, photos, videos) {
  const media = [];
  let html = tweet.full_text ?? "";
  html = html.replace(reHashtag, linkHashtagHtml);
  html = html.replace(reCashtag, linkCashtagHtml);
  html = html.replace(reUsername, linkUsernameHtml);
  html = html.replace(reTwitterUrl, unwrapTcoUrlHtml(tweet, media));
  for (const { url } of photos) {
    if (media.indexOf(url) !== -1) {
      continue;
    }
    html += `<br><img src="${url}"/>`;
  }
  for (const { preview: url } of videos) {
    if (media.indexOf(url) !== -1) {
      continue;
    }
    html += `<br><img src="${url}"/>`;
  }
  html = html.replace(/\n/g, "<br>");
  return html;
}
function linkHashtagHtml(hashtag) {
  return `<a href="https://twitter.com/hashtag/${hashtag.replace(
    "#",
    ""
  )}">${hashtag}</a>`;
}
function linkCashtagHtml(cashtag) {
  return `<a href="https://twitter.com/search?q=%24${cashtag.replace(
    "$",
    ""
  )}">${cashtag}</a>`;
}
function linkUsernameHtml(username) {
  return `<a href="https://twitter.com/${username.replace(
    "@",
    ""
  )}">${username}</a>`;
}
function unwrapTcoUrlHtml(tweet, foundedMedia) {
  return function(tco) {
    for (const entity of tweet.entities?.urls ?? []) {
      if (tco === entity.url && entity.expanded_url != null) {
        return `<a href="${entity.expanded_url}">${tco}</a>`;
      }
    }
    for (const entity of tweet.extended_entities?.media ?? []) {
      if (tco === entity.url && entity.media_url_https != null) {
        foundedMedia.push(entity.media_url_https);
        return `<br><a href="${tco}"><img src="${entity.media_url_https}"/></a>`;
      }
    }
    return tco;
  };
}

function parseLegacyTweet(user, tweet) {
  if (tweet == null) {
    return {
      success: false,
      err: new Error("Tweet was not found in the timeline object.")
    };
  }
  if (user == null) {
    return {
      success: false,
      err: new Error("User was not found in the timeline object.")
    };
  }
  if (!tweet.id_str) {
    if (!tweet.conversation_id_str) {
      return {
        success: false,
        err: new Error("Tweet ID was not found in object.")
      };
    }
    tweet.id_str = tweet.conversation_id_str;
  }
  const hashtags = tweet.entities?.hashtags ?? [];
  const mentions = tweet.entities?.user_mentions ?? [];
  const media = tweet.extended_entities?.media ?? [];
  const pinnedTweets = new Set(
    user.pinned_tweet_ids_str ?? []
  );
  const urls = tweet.entities?.urls ?? [];
  const { photos, videos, sensitiveContent } = parseMediaGroups(media);
  const tw = {
    bookmarkCount: tweet.bookmark_count,
    conversationId: tweet.conversation_id_str,
    id: tweet.id_str,
    hashtags: hashtags.filter(isFieldDefined("text")).map((hashtag) => hashtag.text),
    likes: tweet.favorite_count,
    mentions: mentions.filter(isFieldDefined("id_str")).map((mention) => ({
      id: mention.id_str,
      username: mention.screen_name,
      name: mention.name
    })),
    name: user.name,
    permanentUrl: `https://twitter.com/${user.screen_name}/status/${tweet.id_str}`,
    photos,
    replies: tweet.reply_count,
    retweets: tweet.retweet_count,
    text: tweet.full_text,
    thread: [],
    urls: urls.filter(isFieldDefined("expanded_url")).map((url) => url.expanded_url),
    userId: tweet.user_id_str,
    username: user.screen_name,
    videos,
    isQuoted: false,
    isReply: false,
    isRetweet: false,
    isPin: false,
    sensitiveContent: false
  };
  if (tweet.created_at) {
    tw.timeParsed = new Date(Date.parse(tweet.created_at));
    tw.timestamp = Math.floor(tw.timeParsed.valueOf() / 1e3);
  }
  if (tweet.place?.id) {
    tw.place = tweet.place;
  }
  const quotedStatusIdStr = tweet.quoted_status_id_str;
  const inReplyToStatusIdStr = tweet.in_reply_to_status_id_str;
  const retweetedStatusIdStr = tweet.retweeted_status_id_str;
  const retweetedStatusResult = tweet.retweeted_status_result?.result;
  if (quotedStatusIdStr) {
    tw.isQuoted = true;
    tw.quotedStatusId = quotedStatusIdStr;
  }
  if (inReplyToStatusIdStr) {
    tw.isReply = true;
    tw.inReplyToStatusId = inReplyToStatusIdStr;
  }
  if (retweetedStatusIdStr || retweetedStatusResult) {
    tw.isRetweet = true;
    tw.retweetedStatusId = retweetedStatusIdStr;
    if (retweetedStatusResult) {
      const parsedResult = parseLegacyTweet(
        retweetedStatusResult?.core?.user_results?.result?.legacy,
        retweetedStatusResult?.legacy
      );
      if (parsedResult.success) {
        tw.retweetedStatus = parsedResult.tweet;
      }
    }
  }
  const views = parseInt(tweet.ext_views?.count ?? "");
  if (!isNaN(views)) {
    tw.views = views;
  }
  if (pinnedTweets.has(tweet.id_str)) {
    tw.isPin = true;
  }
  if (sensitiveContent) {
    tw.sensitiveContent = true;
  }
  tw.html = reconstructTweetHtml(tweet, tw.photos, tw.videos);
  return { success: true, tweet: tw };
}
function parseResult(result) {
  const noteTweetResultText = result?.note_tweet?.note_tweet_results?.result?.text;
  if (result?.legacy && noteTweetResultText) {
    result.legacy.full_text = noteTweetResultText;
  }
  const tweetResult = parseLegacyTweet(
    result?.core?.user_results?.result?.legacy,
    result?.legacy
  );
  if (!tweetResult.success) {
    return tweetResult;
  }
  if (!tweetResult.tweet.views && result?.views?.count) {
    const views = parseInt(result.views.count);
    if (!isNaN(views)) {
      tweetResult.tweet.views = views;
    }
  }
  const quotedResult = result?.quoted_status_result?.result;
  if (quotedResult) {
    if (quotedResult.legacy && quotedResult.rest_id) {
      quotedResult.legacy.id_str = quotedResult.rest_id;
    }
    const quotedTweetResult = parseResult(quotedResult);
    if (quotedTweetResult.success) {
      tweetResult.tweet.quotedStatus = quotedTweetResult.tweet;
    }
  }
  return tweetResult;
}
const expectedEntryTypes = ["tweet", "profile-conversation"];
function parseTimelineTweetsV2(timeline) {
  let bottomCursor;
  let topCursor;
  const tweets = [];
  const instructions = timeline.data?.user?.result?.timeline_v2?.timeline?.instructions ?? [];
  for (const instruction of instructions) {
    const entries = instruction.entries ?? [];
    for (const entry of entries) {
      const entryContent = entry.content;
      if (!entryContent) continue;
      if (entryContent.cursorType === "Bottom") {
        bottomCursor = entryContent.value;
        continue;
      } else if (entryContent.cursorType === "Top") {
        topCursor = entryContent.value;
        continue;
      }
      const idStr = entry.entryId;
      if (!expectedEntryTypes.some((entryType) => idStr.startsWith(entryType))) {
        continue;
      }
      if (entryContent.itemContent) {
        parseAndPush(tweets, entryContent.itemContent, idStr);
      } else if (entryContent.items) {
        for (const item of entryContent.items) {
          if (item.item?.itemContent) {
            parseAndPush(tweets, item.item.itemContent, idStr);
          }
        }
      }
    }
  }
  return { tweets, next: bottomCursor, previous: topCursor };
}
function parseTimelineEntryItemContentRaw(content, entryId, isConversation = false) {
  let result = content.tweet_results?.result ?? content.tweetResult?.result;
  if (result?.__typename === "Tweet" || result?.__typename === "TweetWithVisibilityResults" && result?.tweet) {
    if (result?.__typename === "TweetWithVisibilityResults")
      result = result.tweet;
    if (result?.legacy) {
      result.legacy.id_str = result.rest_id ?? entryId.replace("conversation-", "").replace("tweet-", "");
    }
    const tweetResult = parseResult(result);
    if (tweetResult.success) {
      if (isConversation) {
        if (content?.tweetDisplayType === "SelfThread") {
          tweetResult.tweet.isSelfThread = true;
        }
      }
      return tweetResult.tweet;
    }
  }
  return null;
}
function parseAndPush(tweets, content, entryId, isConversation = false) {
  const tweet = parseTimelineEntryItemContentRaw(
    content,
    entryId,
    isConversation
  );
  if (tweet) {
    tweets.push(tweet);
  }
}
function parseThreadedConversation(conversation) {
  const tweets = [];
  const instructions = conversation.data?.threaded_conversation_with_injections_v2?.instructions ?? [];
  for (const instruction of instructions) {
    const entries = instruction.entries ?? [];
    for (const entry of entries) {
      const entryContent = entry.content?.itemContent;
      if (entryContent) {
        parseAndPush(tweets, entryContent, entry.entryId, true);
      }
      for (const item of entry.content?.items ?? []) {
        const itemContent = item.item?.itemContent;
        if (itemContent) {
          parseAndPush(tweets, itemContent, entry.entryId, true);
        }
      }
    }
  }
  for (const tweet of tweets) {
    if (tweet.inReplyToStatusId) {
      for (const parentTweet of tweets) {
        if (parentTweet.id === tweet.inReplyToStatusId) {
          tweet.inReplyToStatus = parentTweet;
          break;
        }
      }
    }
    if (tweet.isSelfThread && tweet.conversationId === tweet.id) {
      for (const childTweet of tweets) {
        if (childTweet.isSelfThread && childTweet.id !== tweet.id) {
          tweet.thread.push(childTweet);
        }
      }
      if (tweet.thread.length === 0) {
        tweet.isSelfThread = false;
      }
    }
  }
  return tweets;
}
function parseArticle(conversation) {
  const articles = [];
  for (const instruction of conversation.data?.threaded_conversation_with_injections_v2?.instructions ?? []) {
    for (const entry of instruction.entries ?? []) {
      const id = entry.content?.itemContent?.tweet_results?.result?.rest_id;
      const article = entry.content?.itemContent?.tweet_results?.result?.article?.article_results?.result;
      if (!id || !article) continue;
      const text = article.content_state?.blocks?.map((block) => block.text).join("\n\n") ?? "";
      articles.push({
        id,
        articleId: article.rest_id || "",
        coverMediaUrl: article.cover_media?.media_info?.original_img_url,
        previewText: article.preview_text || "",
        text,
        title: article.title || ""
      });
    }
  }
  return articles;
}

function parseSearchTimelineTweets(timeline) {
  let bottomCursor;
  let topCursor;
  const tweets = [];
  const instructions = timeline.data?.search_by_raw_query?.search_timeline?.timeline?.instructions ?? [];
  for (const instruction of instructions) {
    if (instruction.type === "TimelineAddEntries" || instruction.type === "TimelineReplaceEntry") {
      if (instruction.entry?.content?.cursorType === "Bottom") {
        bottomCursor = instruction.entry.content.value;
        continue;
      } else if (instruction.entry?.content?.cursorType === "Top") {
        topCursor = instruction.entry.content.value;
        continue;
      }
      const entries = instruction.entries ?? [];
      for (const entry of entries) {
        const itemContent = entry.content?.itemContent;
        if (itemContent?.tweetDisplayType === "Tweet") {
          const tweetResultRaw = itemContent.tweet_results?.result;
          const tweetResult = parseLegacyTweet(
            tweetResultRaw?.core?.user_results?.result?.legacy,
            tweetResultRaw?.legacy
          );
          if (tweetResult.success) {
            if (!tweetResult.tweet.views && tweetResultRaw?.views?.count) {
              const views = parseInt(tweetResultRaw.views.count);
              if (!isNaN(views)) {
                tweetResult.tweet.views = views;
              }
            }
            tweets.push(tweetResult.tweet);
          }
        } else if (entry.content?.cursorType === "Bottom") {
          bottomCursor = entry.content.value;
        } else if (entry.content?.cursorType === "Top") {
          topCursor = entry.content.value;
        }
      }
    }
  }
  return { tweets, next: bottomCursor, previous: topCursor };
}
function parseSearchTimelineUsers(timeline) {
  let bottomCursor;
  let topCursor;
  const profiles = [];
  const instructions = timeline.data?.search_by_raw_query?.search_timeline?.timeline?.instructions ?? [];
  for (const instruction of instructions) {
    if (instruction.type === "TimelineAddEntries" || instruction.type === "TimelineReplaceEntry") {
      if (instruction.entry?.content?.cursorType === "Bottom") {
        bottomCursor = instruction.entry.content.value;
        continue;
      } else if (instruction.entry?.content?.cursorType === "Top") {
        topCursor = instruction.entry.content.value;
        continue;
      }
      const entries = instruction.entries ?? [];
      for (const entry of entries) {
        const itemContent = entry.content?.itemContent;
        if (itemContent?.userDisplayType === "User") {
          const userResultRaw = itemContent.user_results?.result;
          if (userResultRaw?.legacy) {
            const profile = parseProfile(
              userResultRaw.legacy,
              userResultRaw.is_blue_verified
            );
            if (!profile.userId) {
              profile.userId = userResultRaw.rest_id;
            }
            profiles.push(profile);
          }
        } else if (entry.content?.cursorType === "Bottom") {
          bottomCursor = entry.content.value;
        } else if (entry.content?.cursorType === "Top") {
          topCursor = entry.content.value;
        }
      }
    }
  }
  return { profiles, next: bottomCursor, previous: topCursor };
}

var SearchMode = /* @__PURE__ */ ((SearchMode2) => {
  SearchMode2[SearchMode2["Top"] = 0] = "Top";
  SearchMode2[SearchMode2["Latest"] = 1] = "Latest";
  SearchMode2[SearchMode2["Photos"] = 2] = "Photos";
  SearchMode2[SearchMode2["Videos"] = 3] = "Videos";
  SearchMode2[SearchMode2["Users"] = 4] = "Users";
  return SearchMode2;
})(SearchMode || {});
function searchTweets(query, maxTweets, searchMode, auth) {
  return getTweetTimeline(query, maxTweets, (q, mt, c) => {
    return fetchSearchTweets(q, mt, searchMode, auth, c);
  });
}
function searchProfiles(query, maxProfiles, auth) {
  return getUserTimeline(query, maxProfiles, (q, mt, c) => {
    return fetchSearchProfiles(q, mt, auth, c);
  });
}
async function fetchSearchTweets(query, maxTweets, searchMode, auth, cursor) {
  const timeline = await getSearchTimeline(
    query,
    maxTweets,
    searchMode,
    auth,
    cursor
  );
  return parseSearchTimelineTweets(timeline);
}
async function fetchSearchProfiles(query, maxProfiles, auth, cursor) {
  const timeline = await getSearchTimeline(
    query,
    maxProfiles,
    4 /* Users */,
    auth,
    cursor
  );
  return parseSearchTimelineUsers(timeline);
}
async function getSearchTimeline(query, maxItems, searchMode, auth, cursor) {
  if (!auth.isLoggedIn()) {
    throw new Error("Scraper is not logged-in for search.");
  }
  if (maxItems > 50) {
    maxItems = 50;
  }
  const variables = {
    rawQuery: query,
    count: maxItems,
    querySource: "typed_query",
    product: "Top"
  };
  const features = addApiFeatures({
    longform_notetweets_inline_media_enabled: true,
    responsive_web_enhance_cards_enabled: false,
    responsive_web_media_download_video_enabled: false,
    responsive_web_twitter_article_tweet_consumption_enabled: false,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    interactive_text_enabled: false,
    responsive_web_text_conversations_enabled: false,
    vibe_api_enabled: false
  });
  const fieldToggles = {
    withArticleRichContentState: false
  };
  if (cursor != null && cursor != "") {
    variables["cursor"] = cursor;
  }
  switch (searchMode) {
    case 1 /* Latest */:
      variables.product = "Latest";
      break;
    case 2 /* Photos */:
      variables.product = "Photos";
      break;
    case 3 /* Videos */:
      variables.product = "Videos";
      break;
    case 4 /* Users */:
      variables.product = "People";
      break;
  }
  const params = new URLSearchParams();
  params.set("features", stringify(features) ?? "");
  params.set("fieldToggles", stringify(fieldToggles) ?? "");
  params.set("variables", stringify(variables) ?? "");
  const res = await requestApi(
    `https://api.twitter.com/graphql/gkjsKepM6gl_HmFWoWKfgg/SearchTimeline?${params.toString()}`,
    auth
  );
  if (!res.success) {
    throw res.err;
  }
  return res.value;
}
async function fetchQuotedTweetsPage(quotedTweetId, maxTweets, auth, cursor) {
  if (maxTweets > 50) {
    maxTweets = 50;
  }
  const variables = {
    rawQuery: `quoted_tweet_id:${quotedTweetId}`,
    count: maxTweets,
    querySource: "tdqt",
    product: "Top"
  };
  if (cursor && cursor !== "") {
    variables.cursor = cursor;
  }
  const features = addApiFeatures({
    profile_label_improvements_pcf_label_in_post_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: true,
    responsive_web_jetfuel_frame: false,
    responsive_web_grok_share_attachment_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    rweb_video_timestamps_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_grok_image_annotation_enabled: false,
    responsive_web_enhance_cards_enabled: false
  });
  const fieldToggles = {
    withArticleRichContentState: false
  };
  const params = new URLSearchParams();
  params.set("features", stringify(features) ?? "");
  params.set("fieldToggles", stringify(fieldToggles) ?? "");
  params.set("variables", stringify(variables) ?? "");
  const url = `https://x.com/i/api/graphql/1BP5aKg8NvTNvRCyyCyq8g/SearchTimeline?${params.toString()}`;
  const res = await requestApi(url, auth);
  if (!res.success) {
    throw res.err;
  }
  const timeline = res.value;
  return parseSearchTimelineTweets(timeline);
}

function parseRelationshipTimeline(timeline) {
  let bottomCursor;
  let topCursor;
  const profiles = [];
  const instructions = timeline.data?.user?.result?.timeline?.timeline?.instructions ?? [];
  for (const instruction of instructions) {
    if (instruction.type === "TimelineAddEntries" || instruction.type === "TimelineReplaceEntry") {
      if (instruction.entry?.content?.cursorType === "Bottom") {
        bottomCursor = instruction.entry.content.value;
        continue;
      }
      if (instruction.entry?.content?.cursorType === "Top") {
        topCursor = instruction.entry.content.value;
        continue;
      }
      const entries = instruction.entries ?? [];
      for (const entry of entries) {
        const itemContent = entry.content?.itemContent;
        if (itemContent?.userDisplayType === "User") {
          const userResultRaw = itemContent.user_results?.result;
          if (userResultRaw?.legacy) {
            const profile = parseProfile(
              userResultRaw.legacy,
              userResultRaw.is_blue_verified
            );
            if (!profile.userId) {
              profile.userId = userResultRaw.rest_id;
            }
            profiles.push(profile);
          }
        } else if (entry.content?.cursorType === "Bottom") {
          bottomCursor = entry.content.value;
        } else if (entry.content?.cursorType === "Top") {
          topCursor = entry.content.value;
        }
      }
    }
  }
  return { profiles, next: bottomCursor, previous: topCursor };
}

function getFollowing(userId, maxProfiles, auth) {
  return getUserTimeline(userId, maxProfiles, (q, mt, c) => {
    return fetchProfileFollowing(q, mt, auth, c);
  });
}
function getFollowers(userId, maxProfiles, auth) {
  return getUserTimeline(userId, maxProfiles, (q, mt, c) => {
    return fetchProfileFollowers(q, mt, auth, c);
  });
}
async function fetchProfileFollowing(userId, maxProfiles, auth, cursor) {
  const timeline = await getFollowingTimeline(
    userId,
    maxProfiles,
    auth,
    cursor
  );
  return parseRelationshipTimeline(timeline);
}
async function fetchProfileFollowers(userId, maxProfiles, auth, cursor) {
  const timeline = await getFollowersTimeline(
    userId,
    maxProfiles,
    auth,
    cursor
  );
  return parseRelationshipTimeline(timeline);
}
async function getFollowingTimeline(userId, maxItems, auth, cursor) {
  if (!auth.isLoggedIn()) {
    throw new Error("Scraper is not logged-in for profile following.");
  }
  if (maxItems > 50) {
    maxItems = 50;
  }
  const variables = {
    userId,
    count: maxItems,
    includePromotedContent: false
  };
  const features = addApiFeatures({
    responsive_web_twitter_article_tweet_consumption_enabled: false,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_media_download_video_enabled: false
  });
  if (cursor != null && cursor != "") {
    variables["cursor"] = cursor;
  }
  const params = new URLSearchParams();
  params.set("features", stringify(features) ?? "");
  params.set("variables", stringify(variables) ?? "");
  const res = await requestApi(
    `https://twitter.com/i/api/graphql/iSicc7LrzWGBgDPL0tM_TQ/Following?${params.toString()}`,
    auth
  );
  if (!res.success) {
    throw res.err;
  }
  return res.value;
}
async function getFollowersTimeline(userId, maxItems, auth, cursor) {
  if (!auth.isLoggedIn()) {
    throw new Error("Scraper is not logged-in for profile followers.");
  }
  if (maxItems > 50) {
    maxItems = 50;
  }
  const variables = {
    userId,
    count: maxItems,
    includePromotedContent: false
  };
  const features = addApiFeatures({
    responsive_web_twitter_article_tweet_consumption_enabled: false,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_media_download_video_enabled: false
  });
  if (cursor != null && cursor != "") {
    variables["cursor"] = cursor;
  }
  const params = new URLSearchParams();
  params.set("features", stringify(features) ?? "");
  params.set("variables", stringify(variables) ?? "");
  const res = await requestApi(
    `https://twitter.com/i/api/graphql/rRXFSG5vR6drKr5M37YOTw/Followers?${params.toString()}`,
    auth
  );
  if (!res.success) {
    throw res.err;
  }
  return res.value;
}
async function followUser(username, auth) {
  if (!await auth.isLoggedIn()) {
    throw new Error("Must be logged in to follow users");
  }
  const userIdResult = await getUserIdByScreenName(username, auth);
  if (!userIdResult.success) {
    throw new Error(`Failed to get user ID: ${userIdResult.err.message}`);
  }
  const userId = userIdResult.value;
  const requestBody = {
    include_profile_interstitial_type: "1",
    skip_status: "true",
    user_id: userId
  };
  const headers = new headersPolyfill.Headers({
    "Content-Type": "application/x-www-form-urlencoded",
    Referer: `https://twitter.com/${username}`,
    "X-Twitter-Active-User": "yes",
    "X-Twitter-Auth-Type": "OAuth2Session",
    "X-Twitter-Client-Language": "en",
    Authorization: `Bearer ${bearerToken}`
  });
  await auth.installTo(headers, "https://api.twitter.com/1.1/friendships/create.json");
  const res = await auth.fetch(
    "https://api.twitter.com/1.1/friendships/create.json",
    {
      method: "POST",
      headers,
      body: new URLSearchParams(requestBody).toString(),
      credentials: "include"
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to follow user: ${res.statusText}`);
  }
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

async function getTrends(auth) {
  const params = new URLSearchParams();
  addApiParams(params, false);
  params.set("count", "20");
  params.set("candidate_source", "trends");
  params.set("include_page_configuration", "false");
  params.set("entity_tokens", "false");
  const res = await requestApi(
    `https://api.twitter.com/2/guide.json?${params.toString()}`,
    auth
  );
  if (!res.success) {
    throw res.err;
  }
  const instructions = res.value.timeline?.instructions ?? [];
  if (instructions.length < 2) {
    throw new Error("No trend entries found.");
  }
  const entries = instructions[1].addEntries?.entries ?? [];
  if (entries.length < 2) {
    throw new Error("No trend entries found.");
  }
  const items = entries[1].content?.timelineModule?.items ?? [];
  const trends = [];
  for (const item of items) {
    const trend = item.item?.clientEventInfo?.details?.guideDetails?.transparentGuideDetails?.trendMetadata?.trendName;
    if (trend != null) {
      trends.push(trend);
    }
  }
  return trends;
}

const endpoints = {
  // TODO: Migrate other endpoint URLs here
  UserTweets: "https://twitter.com/i/api/graphql/V7H0Ap3_Hh2FyS75OCDO3Q/UserTweets?variables=%7B%22userId%22%3A%224020276615%22%2C%22count%22%3A20%2C%22includePromotedContent%22%3Atrue%2C%22withQuickPromoteEligibilityTweetFields%22%3Atrue%2C%22withVoice%22%3Atrue%2C%22withV2Timeline%22%3Atrue%7D&features=%7B%22rweb_tipjar_consumption_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22communities_web_enable_tweet_community_results_fetch%22%3Atrue%2C%22c9s_tweet_anatomy_moderator_badge_enabled%22%3Atrue%2C%22articles_preview_enabled%22%3Atrue%2C%22tweetypie_unmention_optimization_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Atrue%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22creator_subscriptions_quote_tweet_preview_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22rweb_video_timestamps_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D&fieldToggles=%7B%22withArticlePlainText%22%3Afalse%7D",
  UserTweetsAndReplies: "https://twitter.com/i/api/graphql/E4wA5vo2sjVyvpliUffSCw/UserTweetsAndReplies?variables=%7B%22userId%22%3A%224020276615%22%2C%22count%22%3A40%2C%22cursor%22%3A%22DAABCgABGPWl-F-ATiIKAAIY9YfiF1rRAggAAwAAAAEAAA%22%2C%22includePromotedContent%22%3Atrue%2C%22withCommunity%22%3Atrue%2C%22withVoice%22%3Atrue%2C%22withV2Timeline%22%3Atrue%7D&features=%7B%22rweb_tipjar_consumption_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22communities_web_enable_tweet_community_results_fetch%22%3Atrue%2C%22c9s_tweet_anatomy_moderator_badge_enabled%22%3Atrue%2C%22articles_preview_enabled%22%3Atrue%2C%22tweetypie_unmention_optimization_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Atrue%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22creator_subscriptions_quote_tweet_preview_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22rweb_video_timestamps_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D&fieldToggles=%7B%22withArticlePlainText%22%3Afalse%7D",
  UserLikedTweets: "https://twitter.com/i/api/graphql/eSSNbhECHHWWALkkQq-YTA/Likes?variables=%7B%22userId%22%3A%222244196397%22%2C%22count%22%3A20%2C%22includePromotedContent%22%3Afalse%2C%22withClientEventToken%22%3Afalse%2C%22withBirdwatchNotes%22%3Afalse%2C%22withVoice%22%3Atrue%2C%22withV2Timeline%22%3Atrue%7D&features=%7B%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22c9s_tweet_anatomy_moderator_badge_enabled%22%3Atrue%2C%22tweetypie_unmention_optimization_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Atrue%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22rweb_video_timestamps_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D",
  TweetDetail: "https://twitter.com/i/api/graphql/xOhkmRac04YFZmOzU9PJHg/TweetDetail?variables=%7B%22focalTweetId%22%3A%221237110546383724547%22%2C%22with_rux_injections%22%3Afalse%2C%22includePromotedContent%22%3Atrue%2C%22withCommunity%22%3Atrue%2C%22withQuickPromoteEligibilityTweetFields%22%3Atrue%2C%22withBirdwatchNotes%22%3Atrue%2C%22withVoice%22%3Atrue%2C%22withV2Timeline%22%3Atrue%7D&features=%7B%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22tweetypie_unmention_optimization_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Afalse%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_media_download_video_enabled%22%3Afalse%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D&fieldToggles=%7B%22withArticleRichContentState%22%3Afalse%7D",
  TweetDetailArticle: "https://twitter.com/i/api/graphql/GtcBtFhtQymrpxAs5MALVA/TweetDetail?variables=%7B%22focalTweetId%22%3A%221765884209527394325%22%2C%22with_rux_injections%22%3Atrue%2C%22rankingMode%22%3A%22Relevance%22%2C%22includePromotedContent%22%3Atrue%2C%22withCommunity%22%3Atrue%2C%22withQuickPromoteEligibilityTweetFields%22%3Atrue%2C%22withBirdwatchNotes%22%3Atrue%2C%22withVoice%22%3Atrue%7D&features=%7B%22profile_label_improvements_pcf_label_in_post_enabled%22%3Afalse%2C%22rweb_tipjar_consumption_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22premium_content_api_read_enabled%22%3Afalse%2C%22communities_web_enable_tweet_community_results_fetch%22%3Atrue%2C%22c9s_tweet_anatomy_moderator_badge_enabled%22%3Atrue%2C%22responsive_web_grok_analyze_button_fetch_trends_enabled%22%3Atrue%2C%22responsive_web_grok_analyze_post_followups_enabled%22%3Afalse%2C%22responsive_web_grok_share_attachment_enabled%22%3Atrue%2C%22articles_preview_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Atrue%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22creator_subscriptions_quote_tweet_preview_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22rweb_video_timestamps_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D&fieldToggles=%7B%22withArticleRichContentState%22%3Atrue%2C%22withArticlePlainText%22%3Afalse%2C%22withGrokAnalyze%22%3Afalse%2C%22withDisallowedReplyControls%22%3Afalse%7D",
  TweetResultByRestId: "https://twitter.com/i/api/graphql/DJS3BdhUhcaEpZ7B7irJDg/TweetResultByRestId?variables=%7B%22tweetId%22%3A%221237110546383724547%22%2C%22withCommunity%22%3Afalse%2C%22includePromotedContent%22%3Afalse%2C%22withVoice%22%3Afalse%7D&features=%7B%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22tweetypie_unmention_optimization_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Afalse%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22responsive_web_media_download_video_enabled%22%3Afalse%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D",
  ListTweets: "https://twitter.com/i/api/graphql/whF0_KH1fCkdLLoyNPMoEw/ListLatestTweetsTimeline?variables=%7B%22listId%22%3A%221736495155002106192%22%2C%22count%22%3A20%7D&features=%7B%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22c9s_tweet_anatomy_moderator_badge_enabled%22%3Atrue%2C%22tweetypie_unmention_optimization_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Afalse%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22rweb_video_timestamps_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_media_download_video_enabled%22%3Afalse%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D"
};
class ApiRequest {
  constructor(info) {
    this.url = info.url;
    this.variables = info.variables;
    this.features = info.features;
    this.fieldToggles = info.fieldToggles;
  }
  toRequestUrl() {
    const params = new URLSearchParams();
    if (this.variables) {
      params.set("variables", stringify(this.variables) ?? "");
    }
    if (this.features) {
      params.set("features", stringify(this.features) ?? "");
    }
    if (this.fieldToggles) {
      params.set("fieldToggles", stringify(this.fieldToggles) ?? "");
    }
    return `${this.url}?${params.toString()}`;
  }
}
function parseEndpointExample(example) {
  const { protocol, host, pathname, searchParams: query } = new URL(example);
  const base = `${protocol}//${host}${pathname}`;
  const variables = query.get("variables");
  const features = query.get("features");
  const fieldToggles = query.get("fieldToggles");
  return new ApiRequest({
    url: base,
    variables: variables ? JSON.parse(variables) : void 0,
    features: features ? JSON.parse(features) : void 0,
    fieldToggles: fieldToggles ? JSON.parse(fieldToggles) : void 0
  });
}
function createApiRequestFactory(endpoints2) {
  return Object.entries(endpoints2).map(([endpointName, endpointExample]) => {
    return {
      [`create${endpointName}Request`]: () => {
        return parseEndpointExample(endpointExample);
      }
    };
  }).reduce((agg, next) => {
    return Object.assign(agg, next);
  });
}
const apiRequestFactory = createApiRequestFactory(endpoints);

function parseListTimelineTweets(timeline) {
  let bottomCursor;
  let topCursor;
  const tweets = [];
  const instructions = timeline.data?.list?.tweets_timeline?.timeline?.instructions ?? [];
  for (const instruction of instructions) {
    const entries = instruction.entries ?? [];
    for (const entry of entries) {
      const entryContent = entry.content;
      if (!entryContent) continue;
      if (entryContent.cursorType === "Bottom") {
        bottomCursor = entryContent.value;
        continue;
      } else if (entryContent.cursorType === "Top") {
        topCursor = entryContent.value;
        continue;
      }
      const idStr = entry.entryId;
      if (!idStr.startsWith("tweet") && !idStr.startsWith("list-conversation")) {
        continue;
      }
      if (entryContent.itemContent) {
        parseAndPush(tweets, entryContent.itemContent, idStr);
      } else if (entryContent.items) {
        for (const contentItem of entryContent.items) {
          if (contentItem.item && contentItem.item.itemContent && contentItem.entryId) {
            parseAndPush(
              tweets,
              contentItem.item.itemContent,
              contentItem.entryId.split("tweet-")[1]
            );
          }
        }
      }
    }
  }
  return { tweets, next: bottomCursor, previous: topCursor };
}

const defaultOptions = {
  expansions: [
    "attachments.poll_ids",
    "attachments.media_keys",
    "author_id",
    "referenced_tweets.id",
    "in_reply_to_user_id",
    "edit_history_tweet_ids",
    "geo.place_id",
    "entities.mentions.username",
    "referenced_tweets.id.author_id"
  ],
  tweetFields: [
    "attachments",
    "author_id",
    "context_annotations",
    "conversation_id",
    "created_at",
    "entities",
    "geo",
    "id",
    "in_reply_to_user_id",
    "lang",
    "public_metrics",
    "edit_controls",
    "possibly_sensitive",
    "referenced_tweets",
    "reply_settings",
    "source",
    "text",
    "withheld",
    "note_tweet"
  ],
  pollFields: [
    "duration_minutes",
    "end_datetime",
    "id",
    "options",
    "voting_status"
  ],
  mediaFields: [
    "duration_ms",
    "height",
    "media_key",
    "preview_image_url",
    "type",
    "url",
    "width",
    "public_metrics",
    "alt_text",
    "variants"
  ],
  userFields: [
    "created_at",
    "description",
    "entities",
    "id",
    "location",
    "name",
    "profile_image_url",
    "protected",
    "public_metrics",
    "url",
    "username",
    "verified",
    "withheld"
  ],
  placeFields: [
    "contained_within",
    "country",
    "country_code",
    "full_name",
    "geo",
    "id",
    "name",
    "place_type"
  ]
};
addApiFeatures({
  interactive_text_enabled: true,
  longform_notetweets_inline_media_enabled: false,
  responsive_web_text_conversations_enabled: false,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: false,
  vibe_api_enabled: false
});
async function fetchTweets(userId, maxTweets, cursor, auth) {
  if (maxTweets > 200) {
    maxTweets = 200;
  }
  const userTweetsRequest = apiRequestFactory.createUserTweetsRequest();
  userTweetsRequest.variables.userId = userId;
  userTweetsRequest.variables.count = maxTweets;
  userTweetsRequest.variables.includePromotedContent = false;
  if (cursor != null && cursor != "") {
    userTweetsRequest.variables["cursor"] = cursor;
  }
  const res = await requestApi(
    userTweetsRequest.toRequestUrl(),
    auth
  );
  if (!res.success) {
    throw res.err;
  }
  return parseTimelineTweetsV2(res.value);
}
async function fetchTweetsAndReplies(userId, maxTweets, cursor, auth) {
  if (maxTweets > 40) {
    maxTweets = 40;
  }
  const userTweetsRequest = apiRequestFactory.createUserTweetsAndRepliesRequest();
  userTweetsRequest.variables.userId = userId;
  userTweetsRequest.variables.count = maxTweets;
  userTweetsRequest.variables.includePromotedContent = false;
  if (cursor != null && cursor != "") {
    userTweetsRequest.variables["cursor"] = cursor;
  }
  const res = await requestApi(
    userTweetsRequest.toRequestUrl(),
    auth
  );
  if (!res.success) {
    throw res.err;
  }
  return parseTimelineTweetsV2(res.value);
}
async function createCreateTweetRequestV2(text, auth, tweetId, options) {
  const v2client = auth.getV2Client();
  if (v2client == null) {
    throw new Error("V2 client is not initialized");
  }
  const { poll, quoted_tweet_id } = options || {};
  let tweetConfig;
  if (poll) {
    tweetConfig = {
      text,
      poll: {
        options: poll?.options.map((option) => option.label) ?? [],
        duration_minutes: poll?.duration_minutes ?? 60
      }
    };
  } else if (quoted_tweet_id) {
    tweetConfig = {
      text,
      quote_tweet_id: quoted_tweet_id
    };
  } else if (tweetId) {
    tweetConfig = {
      text,
      reply: {
        in_reply_to_tweet_id: tweetId
      }
    };
  } else {
    tweetConfig = {
      text
    };
  }
  const tweetResponse = await v2client.v2.tweet(tweetConfig);
  let optionsConfig = {};
  if (options?.poll) {
    optionsConfig = {
      expansions: ["attachments.poll_ids"],
      pollFields: [
        "options",
        "duration_minutes",
        "end_datetime",
        "voting_status"
      ]
    };
  }
  return await getTweetV2(tweetResponse.data.id, auth, optionsConfig);
}
function parseTweetV2ToV1(tweetV2, includes, defaultTweetData) {
  let parsedTweet;
  if (defaultTweetData != null) {
    parsedTweet = defaultTweetData;
  }
  parsedTweet = {
    id: tweetV2.id,
    text: tweetV2.text ?? defaultTweetData?.text ?? "",
    hashtags: tweetV2.entities?.hashtags?.map((tag) => tag.tag) ?? defaultTweetData?.hashtags ?? [],
    mentions: tweetV2.entities?.mentions?.map((mention) => ({
      id: mention.id,
      username: mention.username
    })) ?? defaultTweetData?.mentions ?? [],
    urls: tweetV2.entities?.urls?.map((url) => url.url) ?? defaultTweetData?.urls ?? [],
    likes: tweetV2.public_metrics?.like_count ?? defaultTweetData?.likes ?? 0,
    retweets: tweetV2.public_metrics?.retweet_count ?? defaultTweetData?.retweets ?? 0,
    replies: tweetV2.public_metrics?.reply_count ?? defaultTweetData?.replies ?? 0,
    views: tweetV2.public_metrics?.impression_count ?? defaultTweetData?.views ?? 0,
    userId: tweetV2.author_id ?? defaultTweetData?.userId,
    conversationId: tweetV2.conversation_id ?? defaultTweetData?.conversationId,
    photos: defaultTweetData?.photos ?? [],
    videos: defaultTweetData?.videos ?? [],
    poll: defaultTweetData?.poll ?? null,
    username: defaultTweetData?.username ?? "",
    name: defaultTweetData?.name ?? "",
    place: defaultTweetData?.place,
    thread: defaultTweetData?.thread ?? []
  };
  if (includes?.polls?.length) {
    const poll = includes.polls[0];
    parsedTweet.poll = {
      id: poll.id,
      end_datetime: poll.end_datetime ? poll.end_datetime : defaultTweetData?.poll?.end_datetime ? defaultTweetData?.poll?.end_datetime : void 0,
      options: poll.options.map((option) => ({
        position: option.position,
        label: option.label,
        votes: option.votes
      })),
      voting_status: poll.voting_status ?? defaultTweetData?.poll?.voting_status
    };
  }
  if (includes?.media?.length) {
    includes.media.forEach((media) => {
      if (media.type === "photo") {
        parsedTweet.photos.push({
          id: media.media_key,
          url: media.url ?? "",
          alt_text: media.alt_text ?? ""
        });
      } else if (media.type === "video" || media.type === "animated_gif") {
        parsedTweet.videos.push({
          id: media.media_key,
          preview: media.preview_image_url ?? "",
          url: media.variants?.find(
            (variant) => variant.content_type === "video/mp4"
          )?.url ?? ""
        });
      }
    });
  }
  if (includes?.users?.length) {
    const user = includes.users.find(
      (user2) => user2.id === tweetV2.author_id
    );
    if (user) {
      parsedTweet.username = user.username ?? defaultTweetData?.username ?? "";
      parsedTweet.name = user.name ?? defaultTweetData?.name ?? "";
    }
  }
  if (tweetV2?.geo?.place_id && includes?.places?.length) {
    const place = includes.places.find(
      (place2) => place2.id === tweetV2?.geo?.place_id
    );
    if (place) {
      parsedTweet.place = {
        id: place.id,
        full_name: place.full_name ?? defaultTweetData?.place?.full_name ?? "",
        country: place.country ?? defaultTweetData?.place?.country ?? "",
        country_code: place.country_code ?? defaultTweetData?.place?.country_code ?? "",
        name: place.name ?? defaultTweetData?.place?.name ?? "",
        place_type: place.place_type ?? defaultTweetData?.place?.place_type
      };
    }
  }
  return parsedTweet;
}
async function createCreateTweetRequest(text, auth, tweetId, mediaData, hideLinkPreview = false) {
  const onboardingTaskUrl = "https://api.twitter.com/1.1/onboarding/task.json";
  const cookies = await auth.cookieJar().getCookies(onboardingTaskUrl);
  const xCsrfToken = cookies.find((cookie) => cookie.key === "ct0");
  const headers = new Headers({
    authorization: `Bearer ${auth.bearerToken}`,
    cookie: await auth.cookieJar().getCookieString(onboardingTaskUrl),
    "content-type": "application/json",
    "User-Agent": "Mozilla/5.0 (Linux; Android 11; Nokia G20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.88 Mobile Safari/537.36",
    "x-guest-token": auth.guestToken,
    "x-twitter-auth-type": "OAuth2Client",
    "x-twitter-active-user": "yes",
    "x-twitter-client-language": "en",
    "x-csrf-token": xCsrfToken?.value
  });
  const variables = {
    tweet_text: text,
    dark_request: false,
    media: {
      media_entities: [],
      possibly_sensitive: false
    },
    semantic_annotation_ids: []
  };
  if (hideLinkPreview) {
    variables["card_uri"] = "tombstone://card";
  }
  if (mediaData && mediaData.length > 0) {
    const mediaIds = await Promise.all(
      mediaData.map(
        ({ data, mediaType }) => uploadMedia(data, auth, mediaType)
      )
    );
    variables.media.media_entities = mediaIds.map((id) => ({
      media_id: id,
      tagged_users: []
    }));
  }
  if (tweetId) {
    variables.reply = { in_reply_to_tweet_id: tweetId };
  }
  const response = await fetch(
    "https://twitter.com/i/api/graphql/a1p9RWpkYKBjWv_I3WzS-A/CreateTweet",
    {
      headers,
      body: JSON.stringify({
        variables,
        features: {
          interactive_text_enabled: true,
          longform_notetweets_inline_media_enabled: false,
          responsive_web_text_conversations_enabled: false,
          tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: false,
          vibe_api_enabled: false,
          rweb_lists_timeline_redesign_enabled: true,
          responsive_web_graphql_exclude_directive_enabled: true,
          verified_phone_label_enabled: false,
          creator_subscriptions_tweet_preview_api_enabled: true,
          responsive_web_graphql_timeline_navigation_enabled: true,
          responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
          tweetypie_unmention_optimization_enabled: true,
          responsive_web_edit_tweet_api_enabled: true,
          graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
          view_counts_everywhere_api_enabled: true,
          longform_notetweets_consumption_enabled: true,
          tweet_awards_web_tipping_enabled: false,
          freedom_of_speech_not_reach_fetch_enabled: true,
          standardized_nudges_misinfo: true,
          longform_notetweets_rich_text_read_enabled: true,
          responsive_web_enhance_cards_enabled: false,
          subscriptions_verification_info_enabled: true,
          subscriptions_verification_info_reason_enabled: true,
          subscriptions_verification_info_verified_since_enabled: true,
          super_follow_badge_privacy_enabled: false,
          super_follow_exclusive_tweet_notifications_enabled: false,
          super_follow_tweet_api_enabled: false,
          super_follow_user_api_enabled: false,
          android_graphql_skip_api_media_color_palette: false,
          creator_subscriptions_subscription_count_enabled: false,
          blue_business_profile_image_shape_enabled: false,
          unified_cards_ad_metadata_container_dynamic_card_content_query_enabled: false,
          rweb_video_timestamps_enabled: false,
          c9s_tweet_anatomy_moderator_badge_enabled: false,
          responsive_web_twitter_article_tweet_consumption_enabled: false
        },
        fieldToggles: {}
      }),
      method: "POST"
    }
  );
  await updateCookieJar(auth.cookieJar(), response.headers);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response;
}
async function createCreateNoteTweetRequest(text, auth, tweetId, mediaData) {
  const onboardingTaskUrl = "https://api.twitter.com/1.1/onboarding/task.json";
  const cookies = await auth.cookieJar().getCookies(onboardingTaskUrl);
  const xCsrfToken = cookies.find((cookie) => cookie.key === "ct0");
  const headers = new Headers({
    authorization: `Bearer ${auth.bearerToken}`,
    cookie: await auth.cookieJar().getCookieString(onboardingTaskUrl),
    "content-type": "application/json",
    "User-Agent": "Mozilla/5.0 (Linux; Android 11; Nokia G20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.88 Mobile Safari/537.36",
    "x-guest-token": auth.guestToken,
    "x-twitter-auth-type": "OAuth2Client",
    "x-twitter-active-user": "yes",
    "x-twitter-client-language": "en",
    "x-csrf-token": xCsrfToken?.value
  });
  const variables = {
    tweet_text: text,
    dark_request: false,
    media: {
      media_entities: [],
      possibly_sensitive: false
    },
    semantic_annotation_ids: []
  };
  if (mediaData && mediaData.length > 0) {
    const mediaIds = await Promise.all(
      mediaData.map(
        ({ data: data2, mediaType }) => uploadMedia(data2, auth, mediaType)
      )
    );
    variables.media.media_entities = mediaIds.map((id) => ({
      media_id: id,
      tagged_users: []
    }));
  }
  if (tweetId) {
    variables.reply = { in_reply_to_tweet_id: tweetId };
  }
  const response = await fetch(
    "https://twitter.com/i/api/graphql/0aWhJJmFlxkxv9TAUJPanA/CreateNoteTweet",
    {
      headers,
      body: JSON.stringify({
        variables,
        features: {
          interactive_text_enabled: true,
          longform_notetweets_inline_media_enabled: false,
          responsive_web_text_conversations_enabled: false,
          tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: false,
          vibe_api_enabled: false,
          rweb_lists_timeline_redesign_enabled: true,
          responsive_web_graphql_exclude_directive_enabled: true,
          verified_phone_label_enabled: false,
          creator_subscriptions_tweet_preview_api_enabled: true,
          responsive_web_graphql_timeline_navigation_enabled: true,
          responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
          tweetypie_unmention_optimization_enabled: true,
          responsive_web_edit_tweet_api_enabled: true,
          graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
          view_counts_everywhere_api_enabled: true,
          longform_notetweets_consumption_enabled: true,
          longform_notetweets_creation_enabled: true,
          tweet_awards_web_tipping_enabled: false,
          freedom_of_speech_not_reach_fetch_enabled: true,
          standardized_nudges_misinfo: true,
          longform_notetweets_rich_text_read_enabled: true,
          responsive_web_enhance_cards_enabled: false,
          subscriptions_verification_info_enabled: true,
          subscriptions_verification_info_reason_enabled: true,
          subscriptions_verification_info_verified_since_enabled: true,
          super_follow_badge_privacy_enabled: false,
          super_follow_exclusive_tweet_notifications_enabled: false,
          super_follow_tweet_api_enabled: false,
          super_follow_user_api_enabled: false,
          android_graphql_skip_api_media_color_palette: false,
          creator_subscriptions_subscription_count_enabled: false,
          blue_business_profile_image_shape_enabled: false,
          unified_cards_ad_metadata_container_dynamic_card_content_query_enabled: false,
          rweb_video_timestamps_enabled: false,
          c9s_tweet_anatomy_moderator_badge_enabled: false,
          responsive_web_twitter_article_tweet_consumption_enabled: false,
          communities_web_enable_tweet_community_results_fetch: false,
          articles_preview_enabled: false,
          rweb_tipjar_consumption_enabled: false,
          creator_subscriptions_quote_tweet_preview_enabled: false
        },
        fieldToggles: {}
      }),
      method: "POST"
    }
  );
  await updateCookieJar(auth.cookieJar(), response.headers);
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Error response:", errorText);
    throw new Error(`Failed to create long tweet: ${errorText}`);
  }
  const data = await response.json();
  return data;
}
async function fetchListTweets(listId, maxTweets, cursor, auth) {
  if (maxTweets > 200) {
    maxTweets = 200;
  }
  const listTweetsRequest = apiRequestFactory.createListTweetsRequest();
  listTweetsRequest.variables.listId = listId;
  listTweetsRequest.variables.count = maxTweets;
  if (cursor != null && cursor != "") {
    listTweetsRequest.variables["cursor"] = cursor;
  }
  const res = await requestApi(
    listTweetsRequest.toRequestUrl(),
    auth
  );
  if (!res.success) {
    throw res.err;
  }
  return parseListTimelineTweets(res.value);
}
function getTweets(user, maxTweets, auth) {
  return getTweetTimeline(user, maxTweets, async (q, mt, c) => {
    const userIdRes = await getUserIdByScreenName(q, auth);
    if (!userIdRes.success) {
      throw userIdRes.err;
    }
    const { value: userId } = userIdRes;
    return fetchTweets(userId, mt, c, auth);
  });
}
function getTweetsByUserId(userId, maxTweets, auth) {
  return getTweetTimeline(userId, maxTweets, (q, mt, c) => {
    return fetchTweets(q, mt, c, auth);
  });
}
function getTweetsAndReplies(user, maxTweets, auth) {
  return getTweetTimeline(user, maxTweets, async (q, mt, c) => {
    const userIdRes = await getUserIdByScreenName(q, auth);
    if (!userIdRes.success) {
      throw userIdRes.err;
    }
    const { value: userId } = userIdRes;
    return fetchTweetsAndReplies(userId, mt, c, auth);
  });
}
function getTweetsAndRepliesByUserId(userId, maxTweets, auth) {
  return getTweetTimeline(userId, maxTweets, (q, mt, c) => {
    return fetchTweetsAndReplies(q, mt, c, auth);
  });
}
async function getTweetWhere(tweets, query) {
  const isCallback = typeof query === "function";
  for await (const tweet of tweets) {
    const matches = isCallback ? await query(tweet) : checkTweetMatches(tweet, query);
    if (matches) {
      return tweet;
    }
  }
  return null;
}
async function getTweetsWhere(tweets, query) {
  const isCallback = typeof query === "function";
  const filtered = [];
  for await (const tweet of tweets) {
    const matches = isCallback ? query(tweet) : checkTweetMatches(tweet, query);
    if (!matches) continue;
    filtered.push(tweet);
  }
  return filtered;
}
function checkTweetMatches(tweet, options) {
  return Object.keys(options).every((k) => {
    const key = k;
    return tweet[key] === options[key];
  });
}
async function getLatestTweet(user, includeRetweets, max, auth) {
  const timeline = getTweets(user, max, auth);
  return max === 1 ? (await timeline.next()).value : await getTweetWhere(timeline, { isRetweet: includeRetweets });
}
async function getTweet(id, auth) {
  const tweetDetailRequest = apiRequestFactory.createTweetDetailRequest();
  tweetDetailRequest.variables.focalTweetId = id;
  const res = await requestApi(
    tweetDetailRequest.toRequestUrl(),
    auth
  );
  if (!res.success) {
    throw res.err;
  }
  if (!res.value) {
    return null;
  }
  const tweets = parseThreadedConversation(res.value);
  return tweets.find((tweet) => tweet.id === id) ?? null;
}
async function getTweetV2(id, auth, options = defaultOptions) {
  const v2client = auth.getV2Client();
  if (!v2client) {
    throw new Error("V2 client is not initialized");
  }
  try {
    const tweetData = await v2client.v2.singleTweet(id, {
      expansions: options?.expansions,
      "tweet.fields": options?.tweetFields,
      "poll.fields": options?.pollFields,
      "media.fields": options?.mediaFields,
      "user.fields": options?.userFields,
      "place.fields": options?.placeFields
    });
    if (!tweetData?.data) {
      console.warn(`Tweet data not found for ID: ${id}`);
      return null;
    }
    const defaultTweetData = await getTweet(tweetData.data.id, auth);
    const parsedTweet = parseTweetV2ToV1(
      tweetData.data,
      tweetData?.includes,
      defaultTweetData
    );
    return parsedTweet;
  } catch (error) {
    console.error(`Error fetching tweet ${id}:`, error);
    return null;
  }
}
async function getTweetsV2(ids, auth, options = defaultOptions) {
  const v2client = auth.getV2Client();
  if (!v2client) {
    return [];
  }
  try {
    const tweetData = await v2client.v2.tweets(ids, {
      expansions: options?.expansions,
      "tweet.fields": options?.tweetFields,
      "poll.fields": options?.pollFields,
      "media.fields": options?.mediaFields,
      "user.fields": options?.userFields,
      "place.fields": options?.placeFields
    });
    const tweetsV2 = tweetData.data;
    if (tweetsV2.length === 0) {
      console.warn(`No tweet data found for IDs: ${ids.join(", ")}`);
      return [];
    }
    return (await Promise.all(
      tweetsV2.map(
        async (tweet) => await getTweetV2(tweet.id, auth, options)
      )
    )).filter((tweet) => tweet !== null);
  } catch (error) {
    console.error(`Error fetching tweets for IDs: ${ids.join(", ")}`, error);
    return [];
  }
}
async function getTweetAnonymous(id, auth) {
  const tweetResultByRestIdRequest = apiRequestFactory.createTweetResultByRestIdRequest();
  tweetResultByRestIdRequest.variables.tweetId = id;
  const res = await requestApi(
    tweetResultByRestIdRequest.toRequestUrl(),
    auth
  );
  if (!res.success) {
    throw res.err;
  }
  if (!res.value.data) {
    return null;
  }
  return parseTimelineEntryItemContentRaw(res.value.data, id);
}
async function uploadMedia(mediaData, auth, mediaType) {
  const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json";
  const cookies = await auth.cookieJar().getCookies(uploadUrl);
  const xCsrfToken = cookies.find((cookie) => cookie.key === "ct0");
  const headers = new Headers({
    authorization: `Bearer ${auth.bearerToken}`,
    cookie: await auth.cookieJar().getCookieString(uploadUrl),
    "x-csrf-token": xCsrfToken?.value
  });
  const isVideo = mediaType.startsWith("video/");
  if (isVideo) {
    const mediaId = await uploadVideoInChunks(mediaData, mediaType);
    return mediaId;
  } else {
    const form = new FormData();
    form.append("media", new Blob([mediaData], {
      type: mediaType
    }));
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers,
      body: form
    });
    await updateCookieJar(auth.cookieJar(), response.headers);
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data = await response.json();
    return data.media_id_string;
  }
  async function uploadVideoInChunks(mediaData2, mediaType2) {
    const initParams = new URLSearchParams();
    initParams.append("command", "INIT");
    initParams.append("media_type", mediaType2);
    initParams.append("total_bytes", mediaData2.length.toString());
    const initResponse = await fetch(uploadUrl, {
      method: "POST",
      headers,
      body: initParams
    });
    if (!initResponse.ok) {
      throw new Error(await initResponse.text());
    }
    const initData = await initResponse.json();
    const mediaId = initData.media_id_string;
    const segmentSize = 5 * 1024 * 1024;
    let segmentIndex = 0;
    for (let offset = 0; offset < mediaData2.length; offset += segmentSize) {
      const chunk = mediaData2.slice(offset, offset + segmentSize);
      const appendForm = new FormData();
      appendForm.append("command", "APPEND");
      appendForm.append("media_id", mediaId);
      appendForm.append("segment_index", segmentIndex.toString());
      appendForm.append("media", new Blob([chunk]));
      const appendResponse = await fetch(uploadUrl, {
        method: "POST",
        headers,
        body: appendForm
      });
      if (!appendResponse.ok) {
        throw new Error(await appendResponse.text());
      }
      segmentIndex++;
    }
    const finalizeParams = new URLSearchParams();
    finalizeParams.append("command", "FINALIZE");
    finalizeParams.append("media_id", mediaId);
    const finalizeResponse = await fetch(uploadUrl, {
      method: "POST",
      headers,
      body: finalizeParams
    });
    if (!finalizeResponse.ok) {
      throw new Error(await finalizeResponse.text());
    }
    const finalizeData = await finalizeResponse.json();
    if (finalizeData.processing_info) {
      await checkUploadStatus(mediaId);
    }
    return mediaId;
  }
  async function checkUploadStatus(mediaId) {
    let processing = true;
    while (processing) {
      await new Promise((resolve) => setTimeout(resolve, 5e3));
      const statusParams = new URLSearchParams();
      statusParams.append("command", "STATUS");
      statusParams.append("media_id", mediaId);
      const statusResponse = await fetch(
        `${uploadUrl}?${statusParams.toString()}`,
        {
          method: "GET",
          headers
        }
      );
      if (!statusResponse.ok) {
        throw new Error(await statusResponse.text());
      }
      const statusData = await statusResponse.json();
      const state = statusData.processing_info.state;
      if (state === "succeeded") {
        processing = false;
      } else if (state === "failed") {
        throw new Error("Video processing failed");
      }
    }
  }
}
async function createQuoteTweetRequest(text, quotedTweetId, auth, mediaData) {
  const onboardingTaskUrl = "https://api.twitter.com/1.1/onboarding/task.json";
  const cookies = await auth.cookieJar().getCookies(onboardingTaskUrl);
  const xCsrfToken = cookies.find((cookie) => cookie.key === "ct0");
  const headers = new Headers({
    authorization: `Bearer ${auth.bearerToken}`,
    cookie: await auth.cookieJar().getCookieString(onboardingTaskUrl),
    "content-type": "application/json",
    "User-Agent": "Mozilla/5.0 (Linux; Android 11; Nokia G20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.88 Mobile Safari/537.36",
    "x-guest-token": auth.guestToken,
    "x-twitter-auth-type": "OAuth2Client",
    "x-twitter-active-user": "yes",
    "x-csrf-token": xCsrfToken?.value
  });
  const variables = {
    tweet_text: text,
    dark_request: false,
    attachment_url: `https://twitter.com/twitter/status/${quotedTweetId}`,
    media: {
      media_entities: [],
      possibly_sensitive: false
    },
    semantic_annotation_ids: []
  };
  if (mediaData && mediaData.length > 0) {
    const mediaIds = await Promise.all(
      mediaData.map(
        ({ data, mediaType }) => uploadMedia(data, auth, mediaType)
      )
    );
    variables.media.media_entities = mediaIds.map((id) => ({
      media_id: id,
      tagged_users: []
    }));
  }
  const response = await fetch(
    "https://twitter.com/i/api/graphql/a1p9RWpkYKBjWv_I3WzS-A/CreateTweet",
    {
      headers,
      body: JSON.stringify({
        variables,
        features: {
          interactive_text_enabled: true,
          longform_notetweets_inline_media_enabled: false,
          responsive_web_text_conversations_enabled: false,
          tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: false,
          vibe_api_enabled: false,
          rweb_lists_timeline_redesign_enabled: true,
          responsive_web_graphql_exclude_directive_enabled: true,
          verified_phone_label_enabled: false,
          creator_subscriptions_tweet_preview_api_enabled: true,
          responsive_web_graphql_timeline_navigation_enabled: true,
          responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
          tweetypie_unmention_optimization_enabled: true,
          responsive_web_edit_tweet_api_enabled: true,
          graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
          view_counts_everywhere_api_enabled: true,
          longform_notetweets_consumption_enabled: true,
          tweet_awards_web_tipping_enabled: false,
          freedom_of_speech_not_reach_fetch_enabled: true,
          standardized_nudges_misinfo: true,
          longform_notetweets_rich_text_read_enabled: true,
          responsive_web_enhance_cards_enabled: false,
          subscriptions_verification_info_enabled: true,
          subscriptions_verification_info_reason_enabled: true,
          subscriptions_verification_info_verified_since_enabled: true,
          super_follow_badge_privacy_enabled: false,
          super_follow_exclusive_tweet_notifications_enabled: false,
          super_follow_tweet_api_enabled: false,
          super_follow_user_api_enabled: false,
          android_graphql_skip_api_media_color_palette: false,
          creator_subscriptions_subscription_count_enabled: false,
          blue_business_profile_image_shape_enabled: false,
          unified_cards_ad_metadata_container_dynamic_card_content_query_enabled: false,
          rweb_video_timestamps_enabled: true,
          c9s_tweet_anatomy_moderator_badge_enabled: true,
          responsive_web_twitter_article_tweet_consumption_enabled: false
        },
        fieldToggles: {}
      }),
      method: "POST"
    }
  );
  await updateCookieJar(auth.cookieJar(), response.headers);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response;
}
async function likeTweet(tweetId, auth) {
  const likeTweetUrl = "https://twitter.com/i/api/graphql/lI07N6Otwv1PhnEgXILM7A/FavoriteTweet";
  const cookies = await auth.cookieJar().getCookies(likeTweetUrl);
  const xCsrfToken = cookies.find((cookie) => cookie.key === "ct0");
  const headers = new Headers({
    authorization: `Bearer ${auth.bearerToken}`,
    cookie: await auth.cookieJar().getCookieString(likeTweetUrl),
    "content-type": "application/json",
    "x-guest-token": auth.guestToken,
    "x-twitter-auth-type": "OAuth2Client",
    "x-twitter-active-user": "yes",
    "x-csrf-token": xCsrfToken?.value
  });
  const payload = {
    variables: {
      tweet_id: tweetId
    }
  };
  const response = await fetch(likeTweetUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  await updateCookieJar(auth.cookieJar(), response.headers);
  if (!response.ok) {
    throw new Error(await response.text());
  }
}
async function retweet(tweetId, auth) {
  const retweetUrl = "https://twitter.com/i/api/graphql/ojPdsZsimiJrUGLR1sjUtA/CreateRetweet";
  const cookies = await auth.cookieJar().getCookies(retweetUrl);
  const xCsrfToken = cookies.find((cookie) => cookie.key === "ct0");
  const headers = new Headers({
    authorization: `Bearer ${auth.bearerToken}`,
    cookie: await auth.cookieJar().getCookieString(retweetUrl),
    "content-type": "application/json",
    "x-guest-token": auth.guestToken,
    "x-twitter-auth-type": "OAuth2Client",
    "x-twitter-active-user": "yes",
    "x-csrf-token": xCsrfToken?.value
  });
  const payload = {
    variables: {
      tweet_id: tweetId,
      dark_request: false
    }
  };
  const response = await fetch(retweetUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  await updateCookieJar(auth.cookieJar(), response.headers);
  if (!response.ok) {
    throw new Error(await response.text());
  }
}
async function createCreateLongTweetRequest(text, auth, tweetId, mediaData) {
  const url = "https://x.com/i/api/graphql/YNXM2DGuE2Sff6a2JD3Ztw/CreateNoteTweet";
  const onboardingTaskUrl = "https://api.twitter.com/1.1/onboarding/task.json";
  const cookies = await auth.cookieJar().getCookies(onboardingTaskUrl);
  const xCsrfToken = cookies.find((cookie) => cookie.key === "ct0");
  const headers = new Headers({
    authorization: `Bearer ${auth.bearerToken}`,
    cookie: await auth.cookieJar().getCookieString(onboardingTaskUrl),
    "content-type": "application/json",
    "User-Agent": "Mozilla/5.0 (Linux; Android 11; Nokia G20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.88 Mobile Safari/537.36",
    "x-guest-token": auth.guestToken,
    "x-twitter-auth-type": "OAuth2Client",
    "x-twitter-active-user": "yes",
    "x-twitter-client-language": "en",
    "x-csrf-token": xCsrfToken?.value
  });
  const variables = {
    tweet_text: text,
    dark_request: false,
    media: {
      media_entities: [],
      possibly_sensitive: false
    },
    semantic_annotation_ids: []
  };
  if (mediaData && mediaData.length > 0) {
    const mediaIds = await Promise.all(
      mediaData.map(
        ({ data, mediaType }) => uploadMedia(data, auth, mediaType)
      )
    );
    variables.media.media_entities = mediaIds.map((id) => ({
      media_id: id,
      tagged_users: []
    }));
  }
  if (tweetId) {
    variables.reply = { in_reply_to_tweet_id: tweetId };
  }
  const features2 = {
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    profile_label_improvements_pcf_label_in_post_enabled: false,
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    articles_preview_enabled: true,
    rweb_video_timestamps_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_enhance_cards_enabled: false
  };
  const response = await fetch(url, {
    headers,
    body: JSON.stringify({
      variables,
      features: features2,
      queryId: "YNXM2DGuE2Sff6a2JD3Ztw"
    }),
    method: "POST"
  });
  await updateCookieJar(auth.cookieJar(), response.headers);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response;
}
async function getArticle(id, auth) {
  const tweetDetailRequest = apiRequestFactory.createTweetDetailArticleRequest();
  tweetDetailRequest.variables.focalTweetId = id;
  const res = await requestApi(
    tweetDetailRequest.toRequestUrl(),
    auth
  );
  if (!res.success) {
    throw res.err;
  }
  if (!res.value) {
    return null;
  }
  const articles = parseArticle(res.value);
  return articles.find((article) => article.id === id) ?? null;
}
async function fetchRetweetersPage(tweetId, auth, cursor, count = 40) {
  const baseUrl = "https://twitter.com/i/api/graphql/VSnHXwLGADxxtetlPnO7xg/Retweeters";
  const variables = {
    tweetId,
    count,
    cursor,
    includePromotedContent: true
  };
  const features2 = {
    profile_label_improvements_pcf_label_in_post_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: true,
    responsive_web_jetfuel_frame: false,
    responsive_web_grok_share_attachment_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    rweb_video_timestamps_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_grok_image_annotation_enabled: false,
    responsive_web_enhance_cards_enabled: false
  };
  const url = new URL(baseUrl);
  url.searchParams.set("variables", JSON.stringify(variables));
  url.searchParams.set("features", JSON.stringify(features2));
  const cookies = await auth.cookieJar().getCookies(url.toString());
  const xCsrfToken = cookies.find((cookie) => cookie.key === "ct0");
  const headers = new Headers({
    authorization: `Bearer ${auth.bearerToken}`,
    cookie: await auth.cookieJar().getCookieString(url.toString()),
    "content-type": "application/json",
    "x-guest-token": auth.guestToken,
    "x-twitter-auth-type": "OAuth2Client",
    "x-twitter-active-user": "yes",
    "x-csrf-token": xCsrfToken?.value || ""
  });
  const response = await fetch(url.toString(), {
    method: "GET",
    headers
  });
  await updateCookieJar(auth.cookieJar(), response.headers);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const json = await response.json();
  const instructions = json?.data?.retweeters_timeline?.timeline?.instructions || [];
  const retweeters = [];
  let bottomCursor;
  let topCursor;
  for (const instruction of instructions) {
    if (instruction.type === "TimelineAddEntries") {
      for (const entry of instruction.entries) {
        if (entry.content?.itemContent?.user_results?.result) {
          const user = entry.content.itemContent.user_results.result;
          const description = user.legacy?.name ?? "";
          retweeters.push({
            rest_id: user.rest_id,
            screen_name: user.legacy?.screen_name ?? "",
            name: user.legacy?.name ?? "",
            description
          });
        }
        if (entry.content?.entryType === "TimelineTimelineCursor" && entry.content?.cursorType === "Bottom") {
          bottomCursor = entry.content.value;
        }
        if (entry.content?.entryType === "TimelineTimelineCursor" && entry.content?.cursorType === "Top") {
          topCursor = entry.content.value;
        }
      }
    }
  }
  return { retweeters, bottomCursor, topCursor };
}
async function getAllRetweeters(tweetId, auth) {
  let allRetweeters = [];
  let cursor;
  while (true) {
    const { retweeters, bottomCursor, topCursor } = await fetchRetweetersPage(
      tweetId,
      auth,
      cursor,
      40
    );
    allRetweeters = allRetweeters.concat(retweeters);
    const newCursor = bottomCursor || topCursor;
    if (!newCursor || newCursor === cursor) {
      break;
    }
    cursor = newCursor;
  }
  return allRetweeters;
}

async function fetchHomeTimeline(count, seenTweetIds, auth) {
  const variables = {
    count,
    includePromotedContent: true,
    latestControlAvailable: true,
    requestContext: "launch",
    withCommunity: true,
    seenTweetIds
  };
  const features = {
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    rweb_video_timestamps_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_enhance_cards_enabled: false
  };
  const res = await requestApi(
    `https://x.com/i/api/graphql/HJFjzBgCs16TqxewQOeLNg/HomeTimeline?variables=${encodeURIComponent(
      JSON.stringify(variables)
    )}&features=${encodeURIComponent(JSON.stringify(features))}`,
    auth,
    "GET"
  );
  if (!res.success) {
    if (res.err instanceof ApiError) {
      console.error("Error details:", res.err.data);
    }
    throw res.err;
  }
  const home = res.value?.data?.home.home_timeline_urt?.instructions;
  if (!home) {
    return [];
  }
  const entries = [];
  for (const instruction of home) {
    if (instruction.type === "TimelineAddEntries") {
      for (const entry of instruction.entries ?? []) {
        entries.push(entry);
      }
    }
  }
  const tweets = entries.map((entry) => entry.content.itemContent?.tweet_results?.result).filter((tweet) => tweet !== void 0);
  return tweets;
}

async function fetchFollowingTimeline(count, seenTweetIds, auth) {
  const variables = {
    count,
    includePromotedContent: true,
    latestControlAvailable: true,
    requestContext: "launch",
    seenTweetIds
  };
  const features = {
    profile_label_improvements_pcf_label_in_post_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    rweb_video_timestamps_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_enhance_cards_enabled: false
  };
  const res = await requestApi(
    `https://x.com/i/api/graphql/K0X1xbCZUjttdK8RazKAlw/HomeLatestTimeline?variables=${encodeURIComponent(
      JSON.stringify(variables)
    )}&features=${encodeURIComponent(JSON.stringify(features))}`,
    auth,
    "GET"
  );
  if (!res.success) {
    if (res.err instanceof ApiError) {
      console.error("Error details:", res.err.data);
    }
    throw res.err;
  }
  const home = res.value?.data?.home.home_timeline_urt?.instructions;
  if (!home) {
    return [];
  }
  const entries = [];
  for (const instruction of home) {
    if (instruction.type === "TimelineAddEntries") {
      for (const entry of instruction.entries ?? []) {
        entries.push(entry);
      }
    }
  }
  const tweets = entries.map((entry) => entry.content.itemContent?.tweet_results?.result).filter((tweet) => tweet !== void 0);
  return tweets;
}

function parseDirectMessageConversations(data, userId) {
  try {
    const inboxState = data?.inbox_initial_state;
    const conversations = inboxState?.conversations || {};
    const entries = inboxState?.entries || [];
    const users = inboxState?.users || {};
    const parsedUsers = Object.values(users).map(
      (user) => ({
        id: user.id_str,
        screenName: user.screen_name,
        name: user.name,
        profileImageUrl: user.profile_image_url_https,
        description: user.description,
        verified: user.verified,
        protected: user.protected,
        followersCount: user.followers_count,
        friendsCount: user.friends_count
      })
    );
    const messagesByConversation = {};
    entries.forEach((entry) => {
      if (entry.message) {
        const convId = entry.message.conversation_id;
        if (!messagesByConversation[convId]) {
          messagesByConversation[convId] = [];
        }
        messagesByConversation[convId].push(entry.message);
      }
    });
    const parsedConversations = Object.entries(conversations).map(
      ([convId, conv]) => {
        const messages = messagesByConversation[convId] || [];
        messages.sort((a, b) => Number(a.time) - Number(b.time));
        return {
          conversationId: convId,
          messages: parseDirectMessages(messages, users),
          participants: conv.participants.map((p) => ({
            id: p.user_id,
            screenName: users[p.user_id]?.screen_name || p.user_id
          }))
        };
      }
    );
    return {
      conversations: parsedConversations,
      users: parsedUsers,
      cursor: inboxState?.cursor,
      lastSeenEventId: inboxState?.last_seen_event_id,
      trustedLastSeenEventId: inboxState?.trusted_last_seen_event_id,
      untrustedLastSeenEventId: inboxState?.untrusted_last_seen_event_id,
      inboxTimelines: {
        trusted: inboxState?.inbox_timelines?.trusted && {
          status: inboxState.inbox_timelines.trusted.status,
          minEntryId: inboxState.inbox_timelines.trusted.min_entry_id
        },
        untrusted: inboxState?.inbox_timelines?.untrusted && {
          status: inboxState.inbox_timelines.untrusted.status,
          minEntryId: inboxState.inbox_timelines.untrusted.min_entry_id
        }
      },
      userId
    };
  } catch (error) {
    console.error("Error parsing DM conversations:", error);
    return {
      conversations: [],
      users: [],
      userId
    };
  }
}
function parseDirectMessages(messages, users) {
  try {
    return messages.map((msg) => ({
      id: msg.message_data.id,
      text: msg.message_data.text,
      senderId: msg.message_data.sender_id,
      recipientId: msg.message_data.recipient_id,
      createdAt: msg.message_data.time,
      mediaUrls: extractMediaUrls(msg.message_data),
      senderScreenName: users[msg.message_data.sender_id]?.screen_name,
      recipientScreenName: users[msg.message_data.recipient_id]?.screen_name
    }));
  } catch (error) {
    console.error("Error parsing DMs:", error);
    return [];
  }
}
function extractMediaUrls(messageData) {
  const urls = [];
  if (messageData.entities?.urls) {
    messageData.entities.urls.forEach((url) => {
      urls.push(url.expanded_url);
    });
  }
  if (messageData.entities?.media) {
    messageData.entities.media.forEach((media) => {
      urls.push(media.media_url_https || media.media_url);
    });
  }
  return urls.length > 0 ? urls : void 0;
}
async function getDirectMessageConversations(userId, auth, cursor) {
  if (!auth.isLoggedIn()) {
    throw new Error("Authentication required to fetch direct messages");
  }
  const url = "https://twitter.com/i/api/graphql/7s3kOODhC5vgXlO0OlqYdA/DMInboxTimeline";
  const messageListUrl = "https://x.com/i/api/1.1/dm/inbox_initial_state.json";
  const params = new URLSearchParams();
  if (cursor) {
    params.append("cursor", cursor);
  }
  const finalUrl = `${messageListUrl}${params.toString() ? "?" + params.toString() : ""}`;
  const cookies = await auth.cookieJar().getCookies(url);
  const xCsrfToken = cookies.find((cookie) => cookie.key === "ct0");
  const headers = new Headers({
    authorization: `Bearer ${auth.bearerToken}`,
    cookie: await auth.cookieJar().getCookieString(url),
    "content-type": "application/json",
    "User-Agent": "Mozilla/5.0 (Linux; Android 11; Nokia G20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.88 Mobile Safari/537.36",
    "x-guest-token": auth.guestToken,
    "x-twitter-auth-type": "OAuth2Client",
    "x-twitter-active-user": "yes",
    "x-csrf-token": xCsrfToken?.value
  });
  const response = await fetch(finalUrl, {
    method: "GET",
    headers
  });
  await updateCookieJar(auth.cookieJar(), response.headers);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const data = await response.json();
  return parseDirectMessageConversations(data, userId);
}
async function sendDirectMessage(auth, conversation_id, text) {
  if (!auth.isLoggedIn()) {
    throw new Error("Authentication required to send direct messages");
  }
  const url = "https://twitter.com/i/api/graphql/7s3kOODhC5vgXlO0OlqYdA/DMInboxTimeline";
  const messageDmUrl = "https://x.com/i/api/1.1/dm/new2.json";
  const cookies = await auth.cookieJar().getCookies(url);
  const xCsrfToken = cookies.find((cookie) => cookie.key === "ct0");
  const headers = new Headers({
    authorization: `Bearer ${auth.bearerToken}`,
    cookie: await auth.cookieJar().getCookieString(url),
    "content-type": "application/json",
    "User-Agent": "Mozilla/5.0 (Linux; Android 11; Nokia G20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.88 Mobile Safari/537.36",
    "x-guest-token": auth.guestToken,
    "x-twitter-auth-type": "OAuth2Client",
    "x-twitter-active-user": "yes",
    "x-csrf-token": xCsrfToken?.value
  });
  const payload = {
    conversation_id: `${conversation_id}`,
    recipient_ids: false,
    text,
    cards_platform: "Web-12",
    include_cards: 1,
    include_quote_count: true,
    dm_users: false
  };
  const response = await fetch(messageDmUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  await updateCookieJar(auth.cookieJar(), response.headers);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return await response.json();
}

function generateRandomId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
async function fetchAudioSpaceById(variables, auth) {
  const queryId = "Tvv_cNXCbtTcgdy1vWYPMw";
  const operationName = "AudioSpaceById";
  const variablesEncoded = encodeURIComponent(JSON.stringify(variables));
  const features = {
    spaces_2022_h2_spaces_communities: true,
    spaces_2022_h2_clipping: true,
    creator_subscriptions_tweet_preview_api_enabled: true,
    profile_label_improvements_pcf_label_in_post_enabled: false,
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: true,
    articles_preview_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    rweb_video_timestamps_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_enhance_cards_enabled: false
  };
  const featuresEncoded = encodeURIComponent(JSON.stringify(features));
  const url = `https://x.com/i/api/graphql/${queryId}/${operationName}?variables=${variablesEncoded}&features=${featuresEncoded}`;
  const onboardingTaskUrl = "https://api.twitter.com/1.1/onboarding/task.json";
  const cookies = await auth.cookieJar().getCookies(onboardingTaskUrl);
  const xCsrfToken = cookies.find((cookie) => cookie.key === "ct0");
  const headers = new Headers({
    Accept: "*/*",
    Authorization: `Bearer ${auth.bearerToken}`,
    "Content-Type": "application/json",
    Cookie: await auth.cookieJar().getCookieString(onboardingTaskUrl),
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "x-guest-token": auth.guestToken,
    "x-twitter-auth-type": "OAuth2Client",
    "x-twitter-active-user": "yes",
    "x-csrf-token": xCsrfToken?.value
  });
  const response = await auth.fetch(url, {
    headers,
    method: "GET"
  });
  await updateCookieJar(auth.cookieJar(), response.headers);
  if (!response.ok) {
    throw new Error(`Failed to fetch Audio Space: ${await response.text()}`);
  }
  const data = await response.json();
  if (data.errors && data.errors.length > 0) {
    throw new Error(`API Errors: ${JSON.stringify(data.errors)}`);
  }
  return data.data.audioSpace;
}
async function fetchBrowseSpaceTopics(auth) {
  const queryId = "TYpVV9QioZfViHqEqRZxJA";
  const operationName = "BrowseSpaceTopics";
  const variables = {};
  const features = {};
  const variablesEncoded = encodeURIComponent(JSON.stringify(variables));
  const featuresEncoded = encodeURIComponent(JSON.stringify(features));
  const url = `https://x.com/i/api/graphql/${queryId}/${operationName}?variables=${variablesEncoded}&features=${featuresEncoded}`;
  const onboardingTaskUrl = "https://api.twitter.com/1.1/onboarding/task.json";
  const cookies = await auth.cookieJar().getCookies(onboardingTaskUrl);
  const xCsrfToken = cookies.find((cookie) => cookie.key === "ct0");
  const headers = new Headers({
    Accept: "*/*",
    Authorization: `Bearer ${auth.bearerToken}`,
    "Content-Type": "application/json",
    Cookie: await auth.cookieJar().getCookieString(onboardingTaskUrl),
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "x-guest-token": auth.guestToken,
    "x-twitter-auth-type": "OAuth2Client",
    "x-twitter-active-user": "yes",
    "x-csrf-token": xCsrfToken?.value
  });
  const response = await auth.fetch(url, {
    headers,
    method: "GET"
  });
  await updateCookieJar(auth.cookieJar(), response.headers);
  if (!response.ok) {
    throw new Error(`Failed to fetch Space Topics: ${await response.text()}`);
  }
  const data = await response.json();
  if (data.errors && data.errors.length > 0) {
    throw new Error(`API Errors: ${JSON.stringify(data.errors)}`);
  }
  return data.data.browse_space_topics.categories.flatMap(
    (category) => category.subtopics
  );
}
async function fetchCommunitySelectQuery(auth) {
  const queryId = "Lue1DfmoW2cc0225t_8z1w";
  const operationName = "CommunitySelectQuery";
  const variables = {};
  const features = {};
  const variablesEncoded = encodeURIComponent(JSON.stringify(variables));
  const featuresEncoded = encodeURIComponent(JSON.stringify(features));
  const url = `https://x.com/i/api/graphql/${queryId}/${operationName}?variables=${variablesEncoded}&features=${featuresEncoded}`;
  const onboardingTaskUrl = "https://api.twitter.com/1.1/onboarding/task.json";
  const cookies = await auth.cookieJar().getCookies(onboardingTaskUrl);
  const xCsrfToken = cookies.find((cookie) => cookie.key === "ct0");
  const headers = new Headers({
    Accept: "*/*",
    Authorization: `Bearer ${auth.bearerToken}`,
    "Content-Type": "application/json",
    Cookie: await auth.cookieJar().getCookieString(onboardingTaskUrl),
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "x-guest-token": auth.guestToken,
    "x-twitter-auth-type": "OAuth2Client",
    "x-twitter-active-user": "yes",
    "x-csrf-token": xCsrfToken?.value
  });
  const response = await auth.fetch(url, {
    headers,
    method: "GET"
  });
  await updateCookieJar(auth.cookieJar(), response.headers);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Community Select Query: ${await response.text()}`
    );
  }
  const data = await response.json();
  if (data.errors && data.errors.length > 0) {
    throw new Error(`API Errors: ${JSON.stringify(data.errors)}`);
  }
  return data.data.space_hostable_communities;
}
async function fetchLiveVideoStreamStatus(mediaKey, auth) {
  const baseUrl = `https://x.com/i/api/1.1/live_video_stream/status/${mediaKey}`;
  const queryParams = new URLSearchParams({
    client: "web",
    use_syndication_guest_id: "false",
    cookie_set_host: "x.com"
  });
  const url = `${baseUrl}?${queryParams.toString()}`;
  const onboardingTaskUrl = "https://api.twitter.com/1.1/onboarding/task.json";
  const cookies = await auth.cookieJar().getCookies(onboardingTaskUrl);
  const xCsrfToken = cookies.find((cookie) => cookie.key === "ct0");
  const headers = new Headers({
    Accept: "*/*",
    Authorization: `Bearer ${auth.bearerToken}`,
    "Content-Type": "application/json",
    Cookie: await auth.cookieJar().getCookieString(onboardingTaskUrl),
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "x-guest-token": auth.guestToken,
    "x-twitter-auth-type": "OAuth2Client",
    "x-twitter-active-user": "yes",
    "x-csrf-token": xCsrfToken?.value
  });
  try {
    const response = await auth.fetch(url, {
      method: "GET",
      headers
    });
    await updateCookieJar(auth.cookieJar(), response.headers);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch live video stream status: ${await response.text()}`
      );
    }
    return await response.json();
  } catch (error) {
    console.error(
      `Error fetching live video stream status for mediaKey ${mediaKey}:`,
      error
    );
    throw error;
  }
}
async function fetchAuthenticatePeriscope(auth) {
  const queryId = "r7VUmxbfqNkx7uwjgONSNw";
  const operationName = "AuthenticatePeriscope";
  const variables = {};
  const features = {};
  const variablesEncoded = encodeURIComponent(JSON.stringify(variables));
  const featuresEncoded = encodeURIComponent(JSON.stringify(features));
  const url = `https://x.com/i/api/graphql/${queryId}/${operationName}?variables=${variablesEncoded}&features=${featuresEncoded}`;
  const onboardingTaskUrl = "https://api.twitter.com/1.1/onboarding/task.json";
  const cookies = await auth.cookieJar().getCookies(onboardingTaskUrl);
  const xCsrfToken = cookies.find((cookie) => cookie.key === "ct0");
  if (!xCsrfToken) {
    throw new Error("CSRF Token (ct0) not found in cookies.");
  }
  const clientTransactionId = generateRandomId();
  const headers = new Headers({
    Accept: "*/*",
    Authorization: `Bearer ${auth.bearerToken}`,
    "Content-Type": "application/json",
    Cookie: await auth.cookieJar().getCookieString(onboardingTaskUrl),
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "x-guest-token": auth.guestToken,
    "x-twitter-auth-type": "OAuth2Session",
    "x-twitter-active-user": "yes",
    "x-csrf-token": xCsrfToken.value,
    "x-client-transaction-id": clientTransactionId,
    "sec-ch-ua-platform": '"Windows"',
    "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "x-twitter-client-language": "en",
    "sec-ch-ua-mobile": "?0",
    Referer: "https://x.com/i/spaces/start"
  });
  try {
    const response = await auth.fetch(url, {
      method: "GET",
      headers
    });
    await updateCookieJar(auth.cookieJar(), response.headers);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }
    const data = await response.json();
    if (data.errors && data.errors.length > 0) {
      throw new Error(`API Errors: ${JSON.stringify(data.errors)}`);
    }
    if (!data.data.authenticate_periscope) {
      throw new Error("Periscope authentication failed, no data returned.");
    }
    return data.data.authenticate_periscope;
  } catch (error) {
    console.error("Error during Periscope authentication:", error);
    throw error;
  }
}
async function fetchLoginTwitterToken(jwt, auth) {
  const url = "https://proxsee.pscp.tv/api/v2/loginTwitterToken";
  const idempotenceKey = generateRandomId();
  const payload = {
    jwt,
    vendor_id: "m5-proxsee-login-a2011357b73e",
    create_user: true
  };
  const headers = new Headers({
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Referer: "https://x.com/",
    "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "sec-ch-ua-platform": '"Windows"',
    "sec-ch-ua-mobile": "?0",
    "X-Periscope-User-Agent": "Twitter/m5",
    "X-Idempotence": idempotenceKey,
    "X-Attempt": "1"
  });
  try {
    const response = await auth.fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    await updateCookieJar(auth.cookieJar(), response.headers);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }
    const data = await response.json();
    if (!data.cookie || !data.user) {
      throw new Error("Twitter authentication failed, missing data.");
    }
    return data;
  } catch (error) {
    console.error("Error logging into Twitter via Proxsee:", error);
    throw error;
  }
}

async function createGrokConversation(auth) {
  const res = await requestApi(
    "https://x.com/i/api/graphql/6cmfJY3d7EPWuCSXWrkOFg/CreateGrokConversation",
    auth,
    "POST"
  );
  if (!res.success) {
    throw res.err;
  }
  return res.value.data.create_grok_conversation.conversation_id;
}
async function grokChat(options, auth) {
  let { conversationId, messages } = options;
  if (!conversationId) {
    conversationId = await createGrokConversation(auth);
  }
  const responses = messages.map((msg) => ({
    message: msg.content,
    sender: msg.role === "user" ? 1 : 2,
    ...msg.role === "user" && {
      promptSource: "",
      fileAttachments: []
    }
  }));
  const payload = {
    responses,
    systemPromptName: "",
    grokModelOptionId: "grok-2a",
    conversationId,
    returnSearchResults: options.returnSearchResults ?? true,
    returnCitations: options.returnCitations ?? true,
    promptMetadata: {
      promptSource: "NATURAL",
      action: "INPUT"
    },
    imageGenerationCount: 4,
    requestFeatures: {
      eagerTweets: true,
      serverHistory: true
    }
  };
  const res = await requestApi(
    "https://api.x.com/2/grok/add_response.json",
    auth,
    "POST",
    void 0,
    payload
  );
  if (!res.success) {
    throw res.err;
  }
  let chunks;
  if (res.value.text) {
    chunks = res.value.text.split("\n").filter(Boolean).map((chunk) => JSON.parse(chunk));
  } else {
    chunks = [res.value];
  }
  const firstChunk = chunks[0];
  if (firstChunk.result?.responseType === "limiter") {
    return {
      conversationId,
      message: firstChunk.result.message,
      messages: [
        ...messages,
        { role: "assistant", content: firstChunk.result.message }
      ],
      rateLimit: {
        isRateLimited: true,
        message: firstChunk.result.message,
        upsellInfo: firstChunk.result.upsell ? {
          usageLimit: firstChunk.result.upsell.usageLimit,
          quotaDuration: `${firstChunk.result.upsell.quotaDurationCount} ${firstChunk.result.upsell.quotaDurationPeriod}`,
          title: firstChunk.result.upsell.title,
          message: firstChunk.result.upsell.message
        } : void 0
      }
    };
  }
  const fullMessage = chunks.filter((chunk) => chunk.result?.message).map((chunk) => chunk.result.message).join("");
  return {
    conversationId,
    message: fullMessage,
    messages: [...messages, { role: "assistant", content: fullMessage }],
    webResults: chunks.find((chunk) => chunk.result?.webResults)?.result.webResults,
    metadata: chunks[0]
  };
}

const twUrl = "https://twitter.com";
const UserTweetsUrl = "https://twitter.com/i/api/graphql/E3opETHurmVJflFsUBVuUQ/UserTweets";
class Scraper {
  /**
   * Creates a new Scraper object.
   * - Scrapers maintain their own guest tokens for Twitter's internal API.
   * - Reusing Scraper objects is recommended to minimize the time spent authenticating unnecessarily.
   */
  constructor(options) {
    this.options = options;
    this.token = bearerToken;
    this.useGuestAuth();
  }
  /**
   * Initializes auth properties using a guest token.
   * Used when creating a new instance of this class, and when logging out.
   * @internal
   */
  useGuestAuth() {
    this.auth = new TwitterGuestAuth(this.token, this.getAuthOptions());
    this.authTrends = new TwitterGuestAuth(this.token, this.getAuthOptions());
  }
  /**
   * Fetches a Twitter profile.
   * @param username The Twitter username of the profile to fetch, without an `@` at the beginning.
   * @returns The requested {@link Profile}.
   */
  async getProfile(username) {
    const res = await getProfile(username, this.auth);
    return this.handleResponse(res);
  }
  /**
   * Fetches the user ID corresponding to the provided screen name.
   * @param screenName The Twitter screen name of the profile to fetch.
   * @returns The ID of the corresponding account.
   */
  async getUserIdByScreenName(screenName) {
    const res = await getUserIdByScreenName(screenName, this.auth);
    return this.handleResponse(res);
  }
  /**
   *
   * @param userId The user ID of the profile to fetch.
   * @returns The screen name of the corresponding account.
   */
  async getScreenNameByUserId(userId) {
    const response = await getScreenNameByUserId(userId, this.auth);
    return this.handleResponse(response);
  }
  /**
   * Fetches tweets from Twitter.
   * @param query The search query. Any Twitter-compatible query format can be used.
   * @param maxTweets The maximum number of tweets to return.
   * @param includeReplies Whether or not replies should be included in the response.
   * @param searchMode The category filter to apply to the search. Defaults to `Top`.
   * @returns An {@link AsyncGenerator} of tweets matching the provided filters.
   */
  searchTweets(query, maxTweets, searchMode = SearchMode.Top) {
    return searchTweets(query, maxTweets, searchMode, this.auth);
  }
  /**
   * Fetches profiles from Twitter.
   * @param query The search query. Any Twitter-compatible query format can be used.
   * @param maxProfiles The maximum number of profiles to return.
   * @returns An {@link AsyncGenerator} of tweets matching the provided filter(s).
   */
  searchProfiles(query, maxProfiles) {
    return searchProfiles(query, maxProfiles, this.auth);
  }
  /**
   * Fetches tweets from Twitter.
   * @param query The search query. Any Twitter-compatible query format can be used.
   * @param maxTweets The maximum number of tweets to return.
   * @param includeReplies Whether or not replies should be included in the response.
   * @param searchMode The category filter to apply to the search. Defaults to `Top`.
   * @param cursor The search cursor, which can be passed into further requests for more results.
   * @returns A page of results, containing a cursor that can be used in further requests.
   */
  fetchSearchTweets(query, maxTweets, searchMode, cursor) {
    return fetchSearchTweets(query, maxTweets, searchMode, this.auth, cursor);
  }
  /**
   * Fetches profiles from Twitter.
   * @param query The search query. Any Twitter-compatible query format can be used.
   * @param maxProfiles The maximum number of profiles to return.
   * @param cursor The search cursor, which can be passed into further requests for more results.
   * @returns A page of results, containing a cursor that can be used in further requests.
   */
  fetchSearchProfiles(query, maxProfiles, cursor) {
    return fetchSearchProfiles(query, maxProfiles, this.auth, cursor);
  }
  /**
   * Fetches list tweets from Twitter.
   * @param listId The list id
   * @param maxTweets The maximum number of tweets to return.
   * @param cursor The search cursor, which can be passed into further requests for more results.
   * @returns A page of results, containing a cursor that can be used in further requests.
   */
  fetchListTweets(listId, maxTweets, cursor) {
    return fetchListTweets(listId, maxTweets, cursor, this.auth);
  }
  /**
   * Fetch the profiles a user is following
   * @param userId The user whose following should be returned
   * @param maxProfiles The maximum number of profiles to return.
   * @returns An {@link AsyncGenerator} of following profiles for the provided user.
   */
  getFollowing(userId, maxProfiles) {
    return getFollowing(userId, maxProfiles, this.auth);
  }
  /**
   * Fetch the profiles that follow a user
   * @param userId The user whose followers should be returned
   * @param maxProfiles The maximum number of profiles to return.
   * @returns An {@link AsyncGenerator} of profiles following the provided user.
   */
  getFollowers(userId, maxProfiles) {
    return getFollowers(userId, maxProfiles, this.auth);
  }
  /**
   * Fetches following profiles from Twitter.
   * @param userId The user whose following should be returned
   * @param maxProfiles The maximum number of profiles to return.
   * @param cursor The search cursor, which can be passed into further requests for more results.
   * @returns A page of results, containing a cursor that can be used in further requests.
   */
  fetchProfileFollowing(userId, maxProfiles, cursor) {
    return fetchProfileFollowing(userId, maxProfiles, this.auth, cursor);
  }
  /**
   * Fetches profile followers from Twitter.
   * @param userId The user whose following should be returned
   * @param maxProfiles The maximum number of profiles to return.
   * @param cursor The search cursor, which can be passed into further requests for more results.
   * @returns A page of results, containing a cursor that can be used in further requests.
   */
  fetchProfileFollowers(userId, maxProfiles, cursor) {
    return fetchProfileFollowers(userId, maxProfiles, this.auth, cursor);
  }
  /**
   * Fetches the home timeline for the current user. (for you feed)
   * @param count The number of tweets to fetch.
   * @param seenTweetIds An array of tweet IDs that have already been seen.
   * @returns A promise that resolves to the home timeline response.
   */
  async fetchHomeTimeline(count, seenTweetIds) {
    return await fetchHomeTimeline(count, seenTweetIds, this.auth);
  }
  /**
   * Fetches the home timeline for the current user. (following feed)
   * @param count The number of tweets to fetch.
   * @param seenTweetIds An array of tweet IDs that have already been seen.
   * @returns A promise that resolves to the home timeline response.
   */
  async fetchFollowingTimeline(count, seenTweetIds) {
    return await fetchFollowingTimeline(count, seenTweetIds, this.auth);
  }
  async getUserTweets(userId, maxTweets = 200, cursor) {
    if (maxTweets > 200) {
      maxTweets = 200;
    }
    const variables = {
      userId,
      count: maxTweets,
      includePromotedContent: true,
      withQuickPromoteEligibilityTweetFields: true,
      withVoice: true,
      withV2Timeline: true
    };
    if (cursor) {
      variables["cursor"] = cursor;
    }
    const features = {
      rweb_tipjar_consumption_enabled: true,
      responsive_web_graphql_exclude_directive_enabled: true,
      verified_phone_label_enabled: false,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      communities_web_enable_tweet_community_results_fetch: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      articles_preview_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      creator_subscriptions_quote_tweet_preview_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      rweb_video_timestamps_enabled: true,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      responsive_web_enhance_cards_enabled: false
    };
    const fieldToggles = {
      withArticlePlainText: false
    };
    const res = await requestApi(
      `${UserTweetsUrl}?variables=${encodeURIComponent(
        JSON.stringify(variables)
      )}&features=${encodeURIComponent(
        JSON.stringify(features)
      )}&fieldToggles=${encodeURIComponent(JSON.stringify(fieldToggles))}`,
      this.auth
    );
    if (!res.success) {
      throw res.err;
    }
    const timelineV2 = parseTimelineTweetsV2(res.value);
    return {
      tweets: timelineV2.tweets,
      next: timelineV2.next
    };
  }
  async *getUserTweetsIterator(userId, maxTweets = 200) {
    let cursor;
    let retrievedTweets = 0;
    while (retrievedTweets < maxTweets) {
      const response = await this.getUserTweets(
        userId,
        maxTweets - retrievedTweets,
        cursor
      );
      for (const tweet of response.tweets) {
        yield tweet;
        retrievedTweets++;
        if (retrievedTweets >= maxTweets) {
          break;
        }
      }
      cursor = response.next;
      if (!cursor) {
        break;
      }
    }
  }
  /**
   * Fetches the current trends from Twitter.
   * @returns The current list of trends.
   */
  getTrends() {
    return getTrends(this.authTrends);
  }
  /**
   * Fetches tweets from a Twitter user.
   * @param user The user whose tweets should be returned.
   * @param maxTweets The maximum number of tweets to return. Defaults to `200`.
   * @returns An {@link AsyncGenerator} of tweets from the provided user.
   */
  getTweets(user, maxTweets = 200) {
    return getTweets(user, maxTweets, this.auth);
  }
  /**
   * Fetches tweets from a Twitter user using their ID.
   * @param userId The user whose tweets should be returned.
   * @param maxTweets The maximum number of tweets to return. Defaults to `200`.
   * @returns An {@link AsyncGenerator} of tweets from the provided user.
   */
  getTweetsByUserId(userId, maxTweets = 200) {
    return getTweetsByUserId(userId, maxTweets, this.auth);
  }
  /**
   * Send a tweet
   * @param text The text of the tweet
   * @param tweetId The id of the tweet to reply to
   * @param mediaData Optional media data
   * @returns
   */
  async sendTweet(text, replyToTweetId, mediaData, hideLinkPreview) {
    return await createCreateTweetRequest(
      text,
      this.auth,
      replyToTweetId,
      mediaData,
      hideLinkPreview
    );
  }
  async sendNoteTweet(text, replyToTweetId, mediaData) {
    return await createCreateNoteTweetRequest(
      text,
      this.auth,
      replyToTweetId,
      mediaData
    );
  }
  /**
   * Send a long tweet (Note Tweet)
   * @param text The text of the tweet
   * @param tweetId The id of the tweet to reply to
   * @param mediaData Optional media data
   * @returns
   */
  async sendLongTweet(text, replyToTweetId, mediaData) {
    return await createCreateLongTweetRequest(
      text,
      this.auth,
      replyToTweetId,
      mediaData
    );
  }
  /**
   * Send a tweet
   * @param text The text of the tweet
   * @param tweetId The id of the tweet to reply to
   * @param options The options for the tweet
   * @returns
   */
  async sendTweetV2(text, replyToTweetId, options) {
    return await createCreateTweetRequestV2(
      text,
      this.auth,
      replyToTweetId,
      options
    );
  }
  /**
   * Fetches tweets and replies from a Twitter user.
   * @param user The user whose tweets should be returned.
   * @param maxTweets The maximum number of tweets to return. Defaults to `200`.
   * @returns An {@link AsyncGenerator} of tweets from the provided user.
   */
  getTweetsAndReplies(user, maxTweets = 200) {
    return getTweetsAndReplies(user, maxTweets, this.auth);
  }
  /**
   * Fetches tweets and replies from a Twitter user using their ID.
   * @param userId The user whose tweets should be returned.
   * @param maxTweets The maximum number of tweets to return. Defaults to `200`.
   * @returns An {@link AsyncGenerator} of tweets from the provided user.
   */
  getTweetsAndRepliesByUserId(userId, maxTweets = 200) {
    return getTweetsAndRepliesByUserId(userId, maxTweets, this.auth);
  }
  /**
   * Fetches the first tweet matching the given query.
   *
   * Example:
   * ```js
   * const timeline = scraper.getTweets('user', 200);
   * const retweet = await scraper.getTweetWhere(timeline, { isRetweet: true });
   * ```
   * @param tweets The {@link AsyncIterable} of tweets to search through.
   * @param query A query to test **all** tweets against. This may be either an
   * object of key/value pairs or a predicate. If this query is an object, all
   * key/value pairs must match a {@link Tweet} for it to be returned. If this query
   * is a predicate, it must resolve to `true` for a {@link Tweet} to be returned.
   * - All keys are optional.
   * - If specified, the key must be implemented by that of {@link Tweet}.
   */
  getTweetWhere(tweets, query) {
    return getTweetWhere(tweets, query);
  }
  /**
   * Fetches all tweets matching the given query.
   *
   * Example:
   * ```js
   * const timeline = scraper.getTweets('user', 200);
   * const retweets = await scraper.getTweetsWhere(timeline, { isRetweet: true });
   * ```
   * @param tweets The {@link AsyncIterable} of tweets to search through.
   * @param query A query to test **all** tweets against. This may be either an
   * object of key/value pairs or a predicate. If this query is an object, all
   * key/value pairs must match a {@link Tweet} for it to be returned. If this query
   * is a predicate, it must resolve to `true` for a {@link Tweet} to be returned.
   * - All keys are optional.
   * - If specified, the key must be implemented by that of {@link Tweet}.
   */
  getTweetsWhere(tweets, query) {
    return getTweetsWhere(tweets, query);
  }
  /**
   * Fetches the most recent tweet from a Twitter user.
   * @param user The user whose latest tweet should be returned.
   * @param includeRetweets Whether or not to include retweets. Defaults to `false`.
   * @returns The {@link Tweet} object or `null`/`undefined` if it couldn't be fetched.
   */
  getLatestTweet(user, includeRetweets = false, max = 200) {
    return getLatestTweet(user, includeRetweets, max, this.auth);
  }
  /**
   * Fetches a single tweet.
   * @param id The ID of the tweet to fetch.
   * @returns The {@link Tweet} object, or `null` if it couldn't be fetched.
   */
  getTweet(id) {
    if (this.auth instanceof TwitterUserAuth) {
      return getTweet(id, this.auth);
    } else {
      return getTweetAnonymous(id, this.auth);
    }
  }
  /**
   * Fetches a single tweet by ID using the Twitter API v2.
   * Allows specifying optional expansions and fields for more detailed data.
   *
   * @param {string} id - The ID of the tweet to fetch.
   * @param {Object} [options] - Optional parameters to customize the tweet data.
   * @param {string[]} [options.expansions] - Array of expansions to include, e.g., 'attachments.poll_ids'.
   * @param {string[]} [options.tweetFields] - Array of tweet fields to include, e.g., 'created_at', 'public_metrics'.
   * @param {string[]} [options.pollFields] - Array of poll fields to include, if the tweet has a poll, e.g., 'options', 'end_datetime'.
   * @param {string[]} [options.mediaFields] - Array of media fields to include, if the tweet includes media, e.g., 'url', 'preview_image_url'.
   * @param {string[]} [options.userFields] - Array of user fields to include, if user information is requested, e.g., 'username', 'verified'.
   * @param {string[]} [options.placeFields] - Array of place fields to include, if the tweet includes location data, e.g., 'full_name', 'country'.
   * @returns {Promise<TweetV2 | null>} - The tweet data, including requested expansions and fields.
   */
  async getTweetV2(id, options = defaultOptions) {
    return await getTweetV2(id, this.auth, options);
  }
  /**
   * Fetches multiple tweets by IDs using the Twitter API v2.
   * Allows specifying optional expansions and fields for more detailed data.
   *
   * @param {string[]} ids - Array of tweet IDs to fetch.
   * @param {Object} [options] - Optional parameters to customize the tweet data.
   * @param {string[]} [options.expansions] - Array of expansions to include, e.g., 'attachments.poll_ids'.
   * @param {string[]} [options.tweetFields] - Array of tweet fields to include, e.g., 'created_at', 'public_metrics'.
   * @param {string[]} [options.pollFields] - Array of poll fields to include, if tweets contain polls, e.g., 'options', 'end_datetime'.
   * @param {string[]} [options.mediaFields] - Array of media fields to include, if tweets contain media, e.g., 'url', 'preview_image_url'.
   * @param {string[]} [options.userFields] - Array of user fields to include, if user information is requested, e.g., 'username', 'verified'.
   * @param {string[]} [options.placeFields] - Array of place fields to include, if tweets contain location data, e.g., 'full_name', 'country'.
   * @returns {Promise<TweetV2[]> } - Array of tweet data, including requested expansions and fields.
   */
  async getTweetsV2(ids, options = defaultOptions) {
    return await getTweetsV2(ids, this.auth, options);
  }
  /**
   * Returns if the scraper has a guest token. The token may not be valid.
   * @returns `true` if the scraper has a guest token; otherwise `false`.
   */
  hasGuestToken() {
    return this.auth.hasToken() || this.authTrends.hasToken();
  }
  /**
   * Returns if the scraper is logged in as a real user.
   * @returns `true` if the scraper is logged in with a real user account; otherwise `false`.
   */
  async isLoggedIn() {
    return await this.auth.isLoggedIn() && await this.authTrends.isLoggedIn();
  }
  /**
   * Returns the currently logged in user
   * @returns The currently logged in user
   */
  async me() {
    return this.auth.me();
  }
  /**
   * Login to Twitter as a real Twitter account. This enables running
   * searches.
   * @param username The username of the Twitter account to login with.
   * @param password The password of the Twitter account to login with.
   * @param email The email to log in with, if you have email confirmation enabled.
   * @param twoFactorSecret The secret to generate two factor authentication tokens with, if you have two factor authentication enabled.
   */
  async login(username, password, email, twoFactorSecret, appKey, appSecret, accessToken, accessSecret) {
    const userAuth = new TwitterUserAuth(this.token, this.getAuthOptions());
    await userAuth.login(
      username,
      password,
      email,
      twoFactorSecret,
      appKey,
      appSecret,
      accessToken,
      accessSecret
    );
    this.auth = userAuth;
    this.authTrends = userAuth;
  }
  /**
   * Log out of Twitter.
   */
  async logout() {
    await this.auth.logout();
    await this.authTrends.logout();
    this.useGuestAuth();
  }
  /**
   * Retrieves all cookies for the current session.
   * @returns All cookies for the current session.
   */
  async getCookies() {
    return await this.authTrends.cookieJar().getCookies(
      typeof document !== "undefined" ? document.location.toString() : twUrl
    );
  }
  /**
   * Set cookies for the current session.
   * @param cookies The cookies to set for the current session.
   */
  async setCookies(cookies) {
    const userAuth = new TwitterUserAuth(this.token, this.getAuthOptions());
    for (const cookie of cookies) {
      await userAuth.cookieJar().setCookie(cookie, twUrl);
    }
    this.auth = userAuth;
    this.authTrends = userAuth;
  }
  /**
   * Clear all cookies for the current session.
   */
  async clearCookies() {
    await this.auth.cookieJar().removeAllCookies();
    await this.authTrends.cookieJar().removeAllCookies();
  }
  /**
   * Sets the optional cookie to be used in requests.
   * @param _cookie The cookie to be used in requests.
   * @deprecated This function no longer represents any part of Twitter's auth flow.
   * @returns This scraper instance.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  withCookie(_cookie) {
    console.warn(
      "Warning: Scraper#withCookie is deprecated and will be removed in a later version. Use Scraper#login or Scraper#setCookies instead."
    );
    return this;
  }
  /**
   * Sets the optional CSRF token to be used in requests.
   * @param _token The CSRF token to be used in requests.
   * @deprecated This function no longer represents any part of Twitter's auth flow.
   * @returns This scraper instance.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  withXCsrfToken(_token) {
    console.warn(
      "Warning: Scraper#withXCsrfToken is deprecated and will be removed in a later version."
    );
    return this;
  }
  /**
   * Sends a quote tweet.
   * @param text The text of the tweet.
   * @param quotedTweetId The ID of the tweet to quote.
   * @param options Optional parameters, such as media data.
   * @returns The response from the Twitter API.
   */
  async sendQuoteTweet(text, quotedTweetId, options) {
    return await createQuoteTweetRequest(
      text,
      quotedTweetId,
      this.auth,
      options?.mediaData
    );
  }
  /**
   * Likes a tweet with the given tweet ID.
   * @param tweetId The ID of the tweet to like.
   * @returns A promise that resolves when the tweet is liked.
   */
  async likeTweet(tweetId) {
    await likeTweet(tweetId, this.auth);
  }
  /**
   * Retweets a tweet with the given tweet ID.
   * @param tweetId The ID of the tweet to retweet.
   * @returns A promise that resolves when the tweet is retweeted.
   */
  async retweet(tweetId) {
    await retweet(tweetId, this.auth);
  }
  /**
   * Follows a user with the given user ID.
   * @param userId The user ID of the user to follow.
   * @returns A promise that resolves when the user is followed.
   */
  async followUser(userName) {
    await followUser(userName, this.auth);
  }
  /**
   * Fetches direct message conversations
   * @param count Number of conversations to fetch (default: 50)
   * @param cursor Pagination cursor for fetching more conversations
   * @returns Array of DM conversations and other details
   */
  async getDirectMessageConversations(userId, cursor) {
    return await getDirectMessageConversations(userId, this.auth, cursor);
  }
  /**
   * Sends a direct message to a user.
   * @param conversationId The ID of the conversation to send the message to.
   * @param text The text of the message to send.
   * @returns The response from the Twitter API.
   */
  async sendDirectMessage(conversationId, text) {
    return await sendDirectMessage(this.auth, conversationId, text);
  }
  getAuthOptions() {
    return {
      fetch: this.options?.fetch,
      transform: this.options?.transform
    };
  }
  handleResponse(res) {
    if (!res.success) {
      throw res.err;
    }
    return res.value;
  }
  /**
   * Retrieves the details of an Audio Space by its ID.
   * @param id The ID of the Audio Space.
   * @returns The details of the Audio Space.
   */
  async getAudioSpaceById(id) {
    const variables = {
      id,
      isMetatagsQuery: false,
      withReplays: true,
      withListeners: true
    };
    return await fetchAudioSpaceById(variables, this.auth);
  }
  /**
   * Retrieves available space topics.
   * @returns An array of space topics.
   */
  async browseSpaceTopics() {
    return await fetchBrowseSpaceTopics(this.auth);
  }
  /**
   * Retrieves available communities.
   * @returns An array of communities.
   */
  async communitySelectQuery() {
    return await fetchCommunitySelectQuery(this.auth);
  }
  /**
   * Retrieves the status of an Audio Space stream by its media key.
   * @param mediaKey The media key of the Audio Space.
   * @returns The status of the Audio Space stream.
   */
  async getAudioSpaceStreamStatus(mediaKey) {
    return await fetchLiveVideoStreamStatus(mediaKey, this.auth);
  }
  /**
   * Retrieves the status of an Audio Space by its ID.
   * This method internally fetches the Audio Space to obtain the media key,
   * then retrieves the stream status using the media key.
   * @param audioSpaceId The ID of the Audio Space.
   * @returns The status of the Audio Space stream.
   */
  async getAudioSpaceStatus(audioSpaceId) {
    const audioSpace = await this.getAudioSpaceById(audioSpaceId);
    const mediaKey = audioSpace.metadata.media_key;
    if (!mediaKey) {
      throw new Error("Media Key not found in Audio Space metadata.");
    }
    return await this.getAudioSpaceStreamStatus(mediaKey);
  }
  /**
   * Authenticates Periscope to obtain a token.
   * @returns The Periscope authentication token.
   */
  async authenticatePeriscope() {
    return await fetchAuthenticatePeriscope(this.auth);
  }
  /**
   * Logs in to Twitter via Proxsee using the Periscope JWT.
   * @param jwt The JWT obtained from AuthenticatePeriscope.
   * @returns The response containing the cookie and user information.
   */
  async loginTwitterToken(jwt) {
    return await fetchLoginTwitterToken(jwt, this.auth);
  }
  /**
   * Orchestrates the flow: get token -> login -> return Periscope cookie
   */
  async getPeriscopeCookie() {
    const periscopeToken = await this.authenticatePeriscope();
    const loginResponse = await this.loginTwitterToken(periscopeToken);
    return loginResponse.cookie;
  }
  /**
   * Fetches a article (long form tweet) by its ID.
   * @param id The ID of the article to fetch. In the format of (http://x.com/i/article/id)
   * @returns The {@link TimelineArticle} object, or `null` if it couldn't be fetched.
   */
  getArticle(id) {
    return getArticle(id, this.auth);
  }
  /**
   * Creates a new conversation with Grok.
   * @returns A promise that resolves to the conversation ID string.
   */
  async createGrokConversation() {
    return await createGrokConversation(this.auth);
  }
  /**
   * Interact with Grok in a chat-like manner.
   * @param options The options for the Grok chat interaction.
   * @param {GrokMessage[]} options.messages - Array of messages in the conversation.
   * @param {string} [options.conversationId] - Optional ID of an existing conversation.
   * @param {boolean} [options.returnSearchResults] - Whether to return search results.
   * @param {boolean} [options.returnCitations] - Whether to return citations.
   * @returns A promise that resolves to the Grok chat response.
   */
  async grokChat(options) {
    return await grokChat(options, this.auth);
  }
  /**
   * Retrieves all users who retweeted the given tweet.
   * @param tweetId The ID of the tweet.
   * @returns An array of users (retweeters).
   */
  async getRetweetersOfTweet(tweetId) {
    return await getAllRetweeters(tweetId, this.auth);
  }
  /**
   * Fetches all tweets quoting a given tweet ID by chaining requests
   * until no more pages are available.
   * @param quotedTweetId The tweet ID to find quotes of.
   * @param maxTweetsPerPage Max tweets per page (default 20).
   * @returns An array of all Tweet objects referencing the given tweet.
   */
  async getAllQuotedTweets(quotedTweetId, maxTweetsPerPage = 20) {
    const allQuotes = [];
    let cursor;
    let prevCursor;
    while (true) {
      const page = await fetchQuotedTweetsPage(
        quotedTweetId,
        maxTweetsPerPage,
        this.auth,
        cursor
      );
      if (!page.tweets || page.tweets.length === 0) {
        break;
      }
      allQuotes.push(...page.tweets);
      if (!page.next || page.next === cursor || page.next === prevCursor) {
        break;
      }
      prevCursor = cursor;
      cursor = page.next;
    }
    return allQuotes;
  }
}

class ChatClient extends events.EventEmitter {
  constructor(config) {
    super();
    this.connected = false;
    this.spaceId = config.spaceId;
    this.accessToken = config.accessToken;
    this.endpoint = config.endpoint;
    this.logger = config.logger;
  }
  /**
   * Establishes a WebSocket connection to the chat endpoint and sets up event handlers.
   */
  async connect() {
    const wsUrl = `${this.endpoint}/chatapi/v1/chatnow`.replace(
      "https://",
      "wss://"
    );
    this.logger.info("[ChatClient] Connecting =>", wsUrl);
    this.ws = new WebSocket(wsUrl, {
      headers: {
        Origin: "https://x.com",
        "User-Agent": "Mozilla/5.0"
      }
    });
    await this.setupHandlers();
  }
  /**
   * Internal method to set up WebSocket event listeners (open, message, close, error).
   */
  setupHandlers() {
    if (!this.ws) {
      throw new Error("[ChatClient] No WebSocket instance available");
    }
    return new Promise((resolve, reject) => {
      this.ws.on("open", () => {
        this.logger.info("[ChatClient] Connected");
        this.connected = true;
        this.sendAuthAndJoin();
        resolve();
      });
      this.ws.on("message", (data) => {
        this.handleMessage(data.toString());
      });
      this.ws.on("close", () => {
        this.logger.info("[ChatClient] Closed");
        this.connected = false;
        this.emit("disconnected");
      });
      this.ws.on("error", (err) => {
        this.logger.error("[ChatClient] Error =>", err);
        reject(err);
      });
    });
  }
  /**
   * Sends two WebSocket messages to authenticate and join the specified space.
   */
  sendAuthAndJoin() {
    if (!this.ws) return;
    this.ws.send(
      JSON.stringify({
        payload: JSON.stringify({ access_token: this.accessToken }),
        kind: 3
      })
    );
    this.ws.send(
      JSON.stringify({
        payload: JSON.stringify({
          body: JSON.stringify({ room: this.spaceId }),
          kind: 1
        }),
        kind: 2
      })
    );
  }
  /**
   * Sends an emoji reaction to the chat server.
   * @param emoji - The emoji string, e.g. '🔥', '🙏', etc.
   */
  reactWithEmoji(emoji) {
    if (!this.ws || !this.connected) {
      this.logger.warn(
        "[ChatClient] Not connected or WebSocket missing; ignoring reactWithEmoji."
      );
      return;
    }
    const payload = JSON.stringify({
      body: JSON.stringify({ body: emoji, type: 2, v: 2 }),
      kind: 1,
      /*
      // The 'sender' field is not required, it's not even verified by the server
      // Instead of passing attributes down here it's easier to ignore it
      sender: {
        user_id: null,
        twitter_id: null,
        username: null,
        display_name: null,
      },
      */
      payload: JSON.stringify({
        room: this.spaceId,
        body: JSON.stringify({ body: emoji, type: 2, v: 2 })
      }),
      type: 2
    });
    this.ws.send(payload);
  }
  /**
   * Handles inbound WebSocket messages, parsing JSON payloads
   * and emitting relevant events (speakerRequest, occupancyUpdate, etc.).
   */
  handleMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg.payload) return;
    const payload = safeJson(msg.payload);
    if (!payload?.body) return;
    const body = safeJson(payload.body);
    if (body.guestBroadcastingEvent === 1) {
      const req = {
        userId: body.guestRemoteID,
        username: body.guestUsername,
        displayName: payload.sender?.display_name || body.guestUsername,
        sessionUUID: body.sessionUUID
      };
      this.emit("speakerRequest", req);
    }
    if (typeof body.occupancy === "number") {
      const update = {
        occupancy: body.occupancy,
        totalParticipants: body.total_participants || 0
      };
      this.emit("occupancyUpdate", update);
    }
    if (body.guestBroadcastingEvent === 16) {
      this.emit("muteStateChanged", {
        userId: body.guestRemoteID,
        muted: true
      });
    }
    if (body.guestBroadcastingEvent === 17) {
      this.emit("muteStateChanged", {
        userId: body.guestRemoteID,
        muted: false
      });
    }
    if (body.guestBroadcastingEvent === 12) {
      this.emit("newSpeakerAccepted", {
        userId: body.guestRemoteID,
        username: body.guestUsername,
        sessionUUID: body.sessionUUID
      });
    }
    if (body?.type === 2) {
      this.logger.debug("[ChatClient] Emitting guestReaction =>", body);
      this.emit("guestReaction", {
        displayName: body.displayName,
        emoji: body.body
      });
    }
  }
  /**
   * Closes the WebSocket connection if open, and resets internal state.
   */
  async disconnect() {
    if (this.ws) {
      this.logger.info("[ChatClient] Disconnecting...");
      this.ws.close();
      this.ws = void 0;
      this.connected = false;
    }
  }
}
function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const { nonstandard } = wrtc;
const { RTCAudioSource, RTCAudioSink } = nonstandard;
class JanusAudioSource extends events.EventEmitter {
  constructor(options) {
    super();
    this.logger = options?.logger;
    this.source = new RTCAudioSource();
    this.track = this.source.createTrack();
  }
  /**
   * Returns the MediaStreamTrack associated with this audio source.
   */
  getTrack() {
    return this.track;
  }
  /**
   * Pushes PCM data into the RTCAudioSource. Typically 16-bit, single- or multi-channel frames.
   * @param samples - The Int16Array audio samples.
   * @param sampleRate - The sampling rate (e.g., 48000).
   * @param channels - Number of channels (e.g., 1 for mono).
   */
  pushPcmData(samples, sampleRate, channels = 1) {
    if (this.logger?.isDebugEnabled()) {
      this.logger?.debug(
        `[JanusAudioSource] pushPcmData => sampleRate=${sampleRate}, channels=${channels}, frames=${samples.length}`
      );
    }
    this.source.onData({
      samples,
      sampleRate,
      bitsPerSample: 16,
      channelCount: channels,
      numberOfFrames: samples.length / channels
    });
  }
}
class JanusAudioSink extends events.EventEmitter {
  constructor(track, options) {
    super();
    this.active = true;
    this.logger = options?.logger;
    if (track.kind !== "audio") {
      throw new Error("[JanusAudioSink] Provided track is not an audio track");
    }
    this.sink = new RTCAudioSink(track);
    this.sink.ondata = (frame) => {
      if (!this.active) return;
      if (this.logger?.isDebugEnabled()) {
        this.logger?.debug(
          `[JanusAudioSink] ondata => sampleRate=${frame.sampleRate}, bitsPerSample=${frame.bitsPerSample}, channelCount=${frame.channelCount}, frames=${frame.samples.length}`
        );
      }
      this.emit("audioData", frame);
    };
  }
  /**
   * Stops receiving audio data. Once called, no further 'audioData' events will be emitted.
   */
  stop() {
    this.active = false;
    if (this.logger?.isDebugEnabled()) {
      this.logger?.debug("[JanusAudioSink] stop called => stopping the sink");
    }
    this.sink?.stop();
  }
}

const { RTCPeerConnection, MediaStream } = wrtc;
class JanusClient extends events.EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.pollActive = false;
    // Tracks promises waiting for specific Janus events
    this.eventWaiters = [];
    // Tracks subscriber handle+pc for each userId we subscribe to
    this.subscribers = /* @__PURE__ */ new Map();
    this.logger = config.logger;
  }
  /**
   * Initializes this JanusClient for the host scenario:
   *  1) createSession()
   *  2) attachPlugin()
   *  3) createRoom()
   *  4) joinRoom()
   *  5) configure local PeerConnection (send audio, etc.)
   */
  async initialize() {
    this.logger.debug("[JanusClient] initialize() called");
    this.sessionId = await this.createSession();
    this.handleId = await this.attachPlugin();
    this.pollActive = true;
    this.startPolling();
    await this.createRoom();
    this.publisherId = await this.joinRoom();
    this.pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: this.config.turnServers.uris,
          username: this.config.turnServers.username,
          credential: this.config.turnServers.password
        }
      ]
    });
    this.setupPeerEvents();
    this.enableLocalAudio();
    await this.configurePublisher();
    this.logger.info("[JanusClient] Initialization complete");
  }
  /**
   * Initializes this JanusClient for a guest speaker scenario:
   *  1) createSession()
   *  2) attachPlugin()
   *  3) join existing room as publisher (no createRoom call)
   *  4) configure local PeerConnection
   *  5) subscribe to any existing publishers
   */
  async initializeGuestSpeaker(sessionUUID) {
    this.logger.debug("[JanusClient] initializeGuestSpeaker() called");
    this.sessionId = await this.createSession();
    this.handleId = await this.attachPlugin();
    this.pollActive = true;
    this.startPolling();
    const evtPromise = this.waitForJanusEvent(
      (e) => e.janus === "event" && e.plugindata?.plugin === "janus.plugin.videoroom" && e.plugindata?.data?.videoroom === "joined",
      1e4,
      "Guest Speaker joined event"
    );
    const body = {
      request: "join",
      room: this.config.roomId,
      ptype: "publisher",
      display: this.config.userId,
      periscope_user_id: this.config.userId
    };
    await this.sendJanusMessage(this.handleId, body);
    const evt = await evtPromise;
    const data = evt.plugindata?.data;
    this.publisherId = data.id;
    this.logger.debug(
      "[JanusClient] guest joined => publisherId=",
      this.publisherId
    );
    const publishers = data.publishers || [];
    this.logger.debug("[JanusClient] existing publishers =>", publishers);
    this.pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: this.config.turnServers.uris,
          username: this.config.turnServers.username,
          credential: this.config.turnServers.password
        }
      ]
    });
    this.setupPeerEvents();
    this.enableLocalAudio();
    await this.configurePublisher(sessionUUID);
    await Promise.all(
      publishers.map((pub) => this.subscribeSpeaker(pub.display, pub.id))
    );
    this.logger.info("[JanusClient] Guest speaker negotiation complete");
  }
  /**
   * Subscribes to a speaker's audio feed by userId and/or feedId.
   * If feedId=0, we wait for a "publishers" event to discover feedId.
   */
  async subscribeSpeaker(userId, feedId = 0) {
    this.logger.debug("[JanusClient] subscribeSpeaker => userId=", userId);
    const subscriberHandleId = await this.attachPlugin();
    this.logger.debug("[JanusClient] subscriber handle =>", subscriberHandleId);
    if (feedId === 0) {
      const publishersEvt = await this.waitForJanusEvent(
        (e) => e.janus === "event" && e.plugindata?.plugin === "janus.plugin.videoroom" && e.plugindata?.data?.videoroom === "event" && Array.isArray(e.plugindata?.data?.publishers) && e.plugindata?.data?.publishers.length > 0,
        8e3,
        'discover feed_id from "publishers"'
      );
      const list = publishersEvt.plugindata.data.publishers;
      const pub = list.find(
        (p) => p.display === userId || p.periscope_user_id === userId
      );
      if (!pub) {
        throw new Error(
          `[JanusClient] subscribeSpeaker => No publisher found for userId=${userId}`
        );
      }
      feedId = pub.id;
      this.logger.debug("[JanusClient] found feedId =>", feedId);
    }
    this.emit("subscribedSpeaker", { userId, feedId });
    const joinBody = {
      request: "join",
      room: this.config.roomId,
      periscope_user_id: this.config.userId,
      ptype: "subscriber",
      streams: [
        {
          feed: feedId,
          mid: "0",
          send: true
          // indicates we might send audio?
        }
      ]
    };
    await this.sendJanusMessage(subscriberHandleId, joinBody);
    const attachedEvt = await this.waitForJanusEvent(
      (e) => e.janus === "event" && e.sender === subscriberHandleId && e.plugindata?.plugin === "janus.plugin.videoroom" && e.plugindata?.data?.videoroom === "attached" && e.jsep?.type === "offer",
      8e3,
      "subscriber attached + offer"
    );
    this.logger.debug('[JanusClient] subscriber => "attached" with offer');
    const offer = attachedEvt.jsep;
    const subPc = new RTCPeerConnection({
      iceServers: [
        {
          urls: this.config.turnServers.uris,
          username: this.config.turnServers.username,
          credential: this.config.turnServers.password
        }
      ]
    });
    subPc.ontrack = (evt) => {
      this.logger.debug(
        "[JanusClient] subscriber track => kind=%s, readyState=%s, muted=%s",
        evt.track.kind,
        evt.track.readyState,
        evt.track.muted
      );
      const sink = new JanusAudioSink(evt.track, { logger: this.logger });
      sink.on("audioData", (frame) => {
        if (this.logger.isDebugEnabled()) {
          let maxVal = 0;
          for (let i = 0; i < frame.samples.length; i++) {
            const val = Math.abs(frame.samples[i]);
            if (val > maxVal) maxVal = val;
          }
          this.logger.debug(
            `[AudioSink] userId=${userId}, maxAmplitude=${maxVal}`
          );
        }
        this.emit("audioDataFromSpeaker", {
          userId,
          bitsPerSample: frame.bitsPerSample,
          sampleRate: frame.sampleRate,
          numberOfFrames: frame.numberOfFrames,
          channelCount: frame.channelCount,
          samples: frame.samples
        });
      });
    };
    await subPc.setRemoteDescription(offer);
    const answer = await subPc.createAnswer();
    await subPc.setLocalDescription(answer);
    await this.sendJanusMessage(
      subscriberHandleId,
      {
        request: "start",
        room: this.config.roomId,
        periscope_user_id: this.config.userId
      },
      answer
    );
    this.logger.debug("[JanusClient] subscriber => done (user=", userId, ")");
    this.subscribers.set(userId, { handleId: subscriberHandleId, pc: subPc });
  }
  /**
   * Pushes local PCM frames to Janus. If the localAudioSource isn't active, it enables it.
   */
  pushLocalAudio(samples, sampleRate, channels = 1) {
    if (!this.localAudioSource) {
      this.logger.warn("[JanusClient] No localAudioSource => enabling now...");
      this.enableLocalAudio();
    }
    this.localAudioSource?.pushPcmData(samples, sampleRate, channels);
  }
  /**
   * Ensures a local audio track is added to the RTCPeerConnection for publishing.
   */
  enableLocalAudio() {
    if (!this.pc) {
      this.logger.warn(
        "[JanusClient] enableLocalAudio => No RTCPeerConnection"
      );
      return;
    }
    if (this.localAudioSource) {
      this.logger.debug("[JanusClient] localAudioSource already active");
      return;
    }
    this.localAudioSource = new JanusAudioSource({ logger: this.logger });
    const track = this.localAudioSource.getTrack();
    const localStream = new MediaStream();
    localStream.addTrack(track);
    this.pc.addTrack(track, localStream);
  }
  /**
   * Stops the Janus client: ends polling, closes the RTCPeerConnection, etc.
   * Does not destroy or leave the room automatically; call destroyRoom() or leaveRoom() if needed.
   */
  async stop() {
    this.logger.info("[JanusClient] Stopping...");
    this.pollActive = false;
    if (this.pc) {
      this.pc.close();
      this.pc = void 0;
    }
  }
  /**
   * Returns the current Janus sessionId, if any.
   */
  getSessionId() {
    return this.sessionId;
  }
  /**
   * Returns the Janus handleId for the publisher, if any.
   */
  getHandleId() {
    return this.handleId;
  }
  /**
   * Returns the Janus publisherId (internal participant ID), if any.
   */
  getPublisherId() {
    return this.publisherId;
  }
  /**
   * Creates a new Janus session via POST /janus (with "janus":"create").
   */
  async createSession() {
    const transaction = this.randomTid();
    const resp = await fetch(this.config.webrtcUrl, {
      method: "POST",
      headers: {
        Authorization: this.config.credential,
        "Content-Type": "application/json",
        Referer: "https://x.com"
      },
      body: JSON.stringify({
        janus: "create",
        transaction
      })
    });
    if (!resp.ok) {
      throw new Error("[JanusClient] createSession failed");
    }
    const json = await resp.json();
    if (json.janus !== "success") {
      throw new Error("[JanusClient] createSession invalid response");
    }
    return json.data.id;
  }
  /**
   * Attaches to the videoroom plugin via /janus/{sessionId} (with "janus":"attach").
   */
  async attachPlugin() {
    if (!this.sessionId) {
      throw new Error("[JanusClient] attachPlugin => no sessionId");
    }
    const transaction = this.randomTid();
    const resp = await fetch(`${this.config.webrtcUrl}/${this.sessionId}`, {
      method: "POST",
      headers: {
        Authorization: this.config.credential,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        janus: "attach",
        plugin: "janus.plugin.videoroom",
        transaction
      })
    });
    if (!resp.ok) {
      throw new Error("[JanusClient] attachPlugin failed");
    }
    const json = await resp.json();
    if (json.janus !== "success") {
      throw new Error("[JanusClient] attachPlugin invalid response");
    }
    return json.data.id;
  }
  /**
   * Creates a Janus room for the host scenario.
   * For a guest, this step is skipped (the room already exists).
   */
  async createRoom() {
    if (!this.sessionId || !this.handleId) {
      throw new Error("[JanusClient] createRoom => No session/handle");
    }
    const transaction = this.randomTid();
    const body = {
      request: "create",
      room: this.config.roomId,
      periscope_user_id: this.config.userId,
      audiocodec: "opus",
      videocodec: "h264",
      transport_wide_cc_ext: true,
      app_component: "audio-room",
      h264_profile: "42e01f",
      dummy_publisher: false
    };
    const resp = await fetch(
      `${this.config.webrtcUrl}/${this.sessionId}/${this.handleId}`,
      {
        method: "POST",
        headers: {
          Authorization: this.config.credential,
          "Content-Type": "application/json",
          Referer: "https://x.com"
        },
        body: JSON.stringify({
          janus: "message",
          transaction,
          body
        })
      }
    );
    if (!resp.ok) {
      throw new Error(`[JanusClient] createRoom failed => ${resp.status}`);
    }
    const json = await resp.json();
    this.logger.debug("[JanusClient] createRoom =>", JSON.stringify(json));
    if (json.janus === "error") {
      throw new Error(
        `[JanusClient] createRoom error => ${json.error?.reason || "Unknown"}`
      );
    }
    if (json.plugindata?.data?.videoroom !== "created") {
      throw new Error(
        `[JanusClient] unexpected createRoom response => ${JSON.stringify(
          json
        )}`
      );
    }
    this.logger.debug(
      `[JanusClient] Room '${this.config.roomId}' created successfully`
    );
  }
  /**
   * Joins the created room as a publisher, for the host scenario.
   */
  async joinRoom() {
    if (!this.sessionId || !this.handleId) {
      throw new Error("[JanusClient] no session/handle for joinRoom()");
    }
    this.logger.debug("[JanusClient] joinRoom => start");
    const evtPromise = this.waitForJanusEvent(
      (e) => e.janus === "event" && e.plugindata?.plugin === "janus.plugin.videoroom" && e.plugindata?.data?.videoroom === "joined",
      12e3,
      "Host Joined Event"
    );
    const body = {
      request: "join",
      room: this.config.roomId,
      ptype: "publisher",
      display: this.config.userId,
      periscope_user_id: this.config.userId
    };
    await this.sendJanusMessage(this.handleId, body);
    const evt = await evtPromise;
    const publisherId = evt.plugindata.data.id;
    this.logger.debug("[JanusClient] joined room => publisherId=", publisherId);
    return publisherId;
  }
  /**
   * Creates an SDP offer and sends "configure" to Janus with it.
   * Used by both host and guest after attach + join.
   */
  async configurePublisher(sessionUUID = "") {
    if (!this.pc || !this.sessionId || !this.handleId) {
      return;
    }
    this.logger.debug("[JanusClient] createOffer...");
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false
    });
    await this.pc.setLocalDescription(offer);
    this.logger.debug("[JanusClient] sending configure with JSEP...");
    await this.sendJanusMessage(
      this.handleId,
      {
        request: "configure",
        room: this.config.roomId,
        periscope_user_id: this.config.userId,
        session_uuid: sessionUUID,
        stream_name: this.config.streamName,
        vidman_token: this.config.credential
      },
      offer
    );
    this.logger.debug("[JanusClient] waiting for answer...");
  }
  /**
   * Sends a "janus":"message" to the Janus handle, optionally with jsep.
   */
  async sendJanusMessage(handleId, body, jsep) {
    if (!this.sessionId) {
      throw new Error("[JanusClient] No session for sendJanusMessage");
    }
    const transaction = this.randomTid();
    const resp = await fetch(
      `${this.config.webrtcUrl}/${this.sessionId}/${handleId}`,
      {
        method: "POST",
        headers: {
          Authorization: this.config.credential,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          janus: "message",
          transaction,
          body,
          jsep
        })
      }
    );
    if (!resp.ok) {
      throw new Error(
        `[JanusClient] sendJanusMessage failed => status=${resp.status}`
      );
    }
  }
  /**
   * Starts polling /janus/{sessionId}?maxev=1 for events. We parse keepalives, answers, etc.
   */
  startPolling() {
    this.logger.debug("[JanusClient] Starting polling...");
    const doPoll = async () => {
      if (!this.pollActive || !this.sessionId) {
        this.logger.debug("[JanusClient] Polling stopped");
        return;
      }
      try {
        const url = `${this.config.webrtcUrl}/${this.sessionId}?maxev=1&_=${Date.now()}`;
        const resp = await fetch(url, {
          headers: { Authorization: this.config.credential }
        });
        if (resp.ok) {
          const event = await resp.json();
          this.handleJanusEvent(event);
        } else {
          this.logger.warn("[JanusClient] poll error =>", resp.status);
        }
      } catch (err) {
        this.logger.error("[JanusClient] poll exception =>", err);
      }
      setTimeout(doPoll, 500);
    };
    doPoll();
  }
  /**
   * Processes each Janus event received from the poll cycle.
   */
  handleJanusEvent(evt) {
    if (!evt.janus) {
      return;
    }
    if (evt.janus === "keepalive") {
      this.logger.debug("[JanusClient] keepalive received");
      return;
    }
    if (evt.janus === "webrtcup") {
      this.logger.debug("[JanusClient] webrtcup => sender=", evt.sender);
    }
    if (evt.jsep && evt.jsep.type === "answer") {
      this.onReceivedAnswer(evt.jsep);
    }
    if (evt.plugindata?.data?.id) {
      this.publisherId = evt.plugindata.data.id;
    }
    if (evt.error) {
      this.logger.error("[JanusClient] Janus error =>", evt.error.reason);
      this.emit("error", new Error(evt.error.reason));
    }
    for (let i = 0; i < this.eventWaiters.length; i++) {
      const waiter = this.eventWaiters[i];
      if (waiter.predicate(evt)) {
        this.eventWaiters.splice(i, 1);
        waiter.resolve(evt);
        break;
      }
    }
  }
  /**
   * Called whenever we get an SDP "answer" from Janus. Sets the remote description on our PC.
   */
  async onReceivedAnswer(answer) {
    if (!this.pc) {
      return;
    }
    this.logger.debug("[JanusClient] got answer => setRemoteDescription");
    await this.pc.setRemoteDescription(answer);
  }
  /**
   * Sets up events on our main RTCPeerConnection for ICE changes, track additions, etc.
   */
  setupPeerEvents() {
    if (!this.pc) {
      return;
    }
    this.pc.addEventListener("iceconnectionstatechange", () => {
      this.logger.debug(
        "[JanusClient] ICE state =>",
        this.pc?.iceConnectionState
      );
      if (this.pc?.iceConnectionState === "failed") {
        this.emit("error", new Error("[JanusClient] ICE connection failed"));
      }
    });
    this.pc.addEventListener("track", (evt) => {
      this.logger.debug("[JanusClient] ontrack => kind=", evt.track.kind);
    });
  }
  /**
   * Generates a random transaction ID for Janus requests.
   */
  randomTid() {
    return Math.random().toString(36).slice(2, 10);
  }
  /**
   * Waits for a specific Janus event (e.g., "joined", "attached", etc.)
   * that matches a given predicate. Times out after timeoutMs if not received.
   */
  async waitForJanusEvent(predicate, timeoutMs = 5e3, description = "some event") {
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, reject };
      this.eventWaiters.push(waiter);
      setTimeout(() => {
        const idx = this.eventWaiters.indexOf(waiter);
        if (idx !== -1) {
          this.eventWaiters.splice(idx, 1);
          this.logger.warn(
            `[JanusClient] waitForJanusEvent => timed out waiting for: ${description}`
          );
          reject(
            new Error(
              `[JanusClient] waitForJanusEvent (expecting "${description}") timed out after ${timeoutMs}ms`
            )
          );
        }
      }, timeoutMs);
    });
  }
  /**
   * Destroys the Janus room (host only). Does not close local PC or stop polling.
   */
  async destroyRoom() {
    if (!this.sessionId || !this.handleId) {
      this.logger.warn("[JanusClient] destroyRoom => no session/handle");
      return;
    }
    if (!this.config.roomId || !this.config.userId) {
      this.logger.warn("[JanusClient] destroyRoom => no roomId/userId");
      return;
    }
    const transaction = this.randomTid();
    const body = {
      request: "destroy",
      room: this.config.roomId,
      periscope_user_id: this.config.userId
    };
    this.logger.info("[JanusClient] destroying room =>", body);
    const resp = await fetch(
      `${this.config.webrtcUrl}/${this.sessionId}/${this.handleId}`,
      {
        method: "POST",
        headers: {
          Authorization: this.config.credential,
          "Content-Type": "application/json",
          Referer: "https://x.com"
        },
        body: JSON.stringify({
          janus: "message",
          transaction,
          body
        })
      }
    );
    if (!resp.ok) {
      throw new Error(`[JanusClient] destroyRoom failed => ${resp.status}`);
    }
    const json = await resp.json();
    this.logger.debug("[JanusClient] destroyRoom =>", JSON.stringify(json));
  }
  /**
   * Leaves the Janus room if we've joined. Does not close the local PC or stop polling.
   */
  async leaveRoom() {
    if (!this.sessionId || !this.handleId) {
      this.logger.warn("[JanusClient] leaveRoom => no session/handle");
      return;
    }
    const transaction = this.randomTid();
    const body = {
      request: "leave",
      room: this.config.roomId,
      periscope_user_id: this.config.userId
    };
    this.logger.info("[JanusClient] leaving room =>", body);
    const resp = await fetch(
      `${this.config.webrtcUrl}/${this.sessionId}/${this.handleId}`,
      {
        method: "POST",
        headers: {
          Authorization: this.config.credential,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          janus: "message",
          transaction,
          body
        })
      }
    );
    if (!resp.ok) {
      throw new Error(`[JanusClient] leaveRoom => error code ${resp.status}`);
    }
    const json = await resp.json();
    this.logger.debug("[JanusClient] leaveRoom =>", JSON.stringify(json));
  }
}

async function authorizeToken(cookie) {
  const headers = new headersPolyfill.Headers({
    "X-Periscope-User-Agent": "Twitter/m5",
    "Content-Type": "application/json",
    "X-Idempotence": Date.now().toString(),
    Referer: "https://x.com/",
    "X-Attempt": "1"
  });
  const resp = await fetch("https://proxsee.pscp.tv/api/v2/authorizeToken", {
    method: "POST",
    headers,
    body: JSON.stringify({
      service: "guest",
      cookie
    })
  });
  if (!resp.ok) {
    throw new Error(
      `authorizeToken => request failed with status ${resp.status}`
    );
  }
  const data = await resp.json();
  if (!data.authorization_token) {
    throw new Error(
      "authorizeToken => Missing authorization_token in response"
    );
  }
  return data.authorization_token;
}
async function publishBroadcast(params) {
  const headers = new headersPolyfill.Headers({
    "X-Periscope-User-Agent": "Twitter/m5",
    "Content-Type": "application/json",
    Referer: "https://x.com/",
    "X-Idempotence": Date.now().toString(),
    "X-Attempt": "1"
  });
  await fetch("https://proxsee.pscp.tv/api/v2/publishBroadcast", {
    method: "POST",
    headers,
    body: JSON.stringify({
      accept_guests: true,
      broadcast_id: params.broadcast.room_id,
      webrtc_handle_id: params.janusHandleId,
      webrtc_session_id: params.janusSessionId,
      janus_publisher_id: params.janusPublisherId,
      janus_room_id: params.broadcast.room_id,
      cookie: params.cookie,
      status: params.title,
      conversation_controls: 0
    })
  });
}
async function getTurnServers(cookie) {
  const headers = new headersPolyfill.Headers({
    "X-Periscope-User-Agent": "Twitter/m5",
    "Content-Type": "application/json",
    Referer: "https://x.com/",
    "X-Idempotence": Date.now().toString(),
    "X-Attempt": "1"
  });
  const resp = await fetch("https://proxsee.pscp.tv/api/v2/turnServers", {
    method: "POST",
    headers,
    body: JSON.stringify({ cookie })
  });
  if (!resp.ok) {
    throw new Error(
      `getTurnServers => request failed with status ${resp.status}`
    );
  }
  return resp.json();
}
async function getRegion() {
  const resp = await fetch("https://signer.pscp.tv/region", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://x.com"
    },
    body: JSON.stringify({})
  });
  if (!resp.ok) {
    throw new Error(`getRegion => request failed with status ${resp.status}`);
  }
  const data = await resp.json();
  return data.region;
}
async function createBroadcast(params) {
  const headers = new headersPolyfill.Headers({
    "X-Periscope-User-Agent": "Twitter/m5",
    "Content-Type": "application/json",
    "X-Idempotence": Date.now().toString(),
    Referer: "https://x.com/",
    "X-Attempt": "1"
  });
  const resp = await fetch("https://proxsee.pscp.tv/api/v2/createBroadcast", {
    method: "POST",
    headers,
    body: JSON.stringify({
      app_component: "audio-room",
      content_type: "visual_audio",
      cookie: params.cookie,
      conversation_controls: 0,
      description: params.description || "",
      height: 1080,
      is_360: false,
      is_space_available_for_replay: params.record,
      is_webrtc: true,
      languages: params.languages ?? [],
      region: params.region,
      width: 1920
    })
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(
      `createBroadcast => request failed with status ${resp.status} ${text}`
    );
  }
  const data = await resp.json();
  return data;
}
async function accessChat(chatToken, cookie) {
  const url = "https://proxsee.pscp.tv/api/v2/accessChat";
  const headers = new headersPolyfill.Headers({
    "Content-Type": "application/json",
    "X-Periscope-User-Agent": "Twitter/m5"
  });
  const body = {
    chat_token: chatToken,
    cookie
  };
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    throw new Error(`accessChat => request failed with status ${resp.status}`);
  }
  return resp.json();
}
async function startWatching(lifecycleToken, cookie) {
  const url = "https://proxsee.pscp.tv/api/v2/startWatching";
  const headers = new headersPolyfill.Headers({
    "Content-Type": "application/json",
    "X-Periscope-User-Agent": "Twitter/m5"
  });
  const body = {
    auto_play: false,
    life_cycle_token: lifecycleToken,
    cookie
  };
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    throw new Error(
      `startWatching => request failed with status ${resp.status}`
    );
  }
  const json = await resp.json();
  return json.session;
}
async function stopWatching(session, cookie) {
  const url = "https://proxsee.pscp.tv/api/v2/stopWatching";
  const headers = new headersPolyfill.Headers({
    "Content-Type": "application/json",
    "X-Periscope-User-Agent": "Twitter/m5"
  });
  const body = { session, cookie };
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    throw new Error(
      `stopWatching => request failed with status ${resp.status}`
    );
  }
}
async function submitSpeakerRequest(params) {
  const url = "https://guest.pscp.tv/api/v1/audiospace/request/submit";
  const headers = new headersPolyfill.Headers({
    "Content-Type": "application/json",
    Authorization: params.authToken
  });
  const body = {
    ntpForBroadcasterFrame: "2208988800030000000",
    ntpForLiveFrame: "2208988800030000000",
    broadcast_id: params.broadcastId,
    chat_token: params.chatToken
  };
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    throw new Error(
      `submitSpeakerRequest => request failed with status ${resp.status}`
    );
  }
  return resp.json();
}
async function cancelSpeakerRequest(params) {
  const url = "https://guest.pscp.tv/api/v1/audiospace/request/cancel";
  const headers = new headersPolyfill.Headers({
    "Content-Type": "application/json",
    Authorization: params.authToken
  });
  const body = {
    ntpForBroadcasterFrame: "2208988800002000000",
    ntpForLiveFrame: "2208988800002000000",
    broadcast_id: params.broadcastId,
    session_uuid: params.sessionUUID,
    chat_token: params.chatToken
  };
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    throw new Error(
      `cancelSpeakerRequest => request failed with status ${resp.status}`
    );
  }
  return resp.json();
}
async function negotiateGuestStream(params) {
  const url = "https://guest.pscp.tv/api/v1/audiospace/stream/negotiate";
  const headers = new headersPolyfill.Headers({
    "Content-Type": "application/json",
    Authorization: params.authToken
  });
  const body = {
    session_uuid: params.sessionUUID
  };
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    throw new Error(
      `negotiateGuestStream => request failed with status ${resp.status}`
    );
  }
  return resp.json();
}
async function muteSpeaker(params) {
  const url = "https://guest.pscp.tv/api/v1/audiospace/muteSpeaker";
  const body = {
    ntpForBroadcasterFrame: 2208988800031e6,
    ntpForLiveFrame: 2208988800031e6,
    session_uuid: params.sessionUUID ?? "",
    broadcast_id: params.broadcastId,
    chat_token: params.chatToken
  };
  const headers = new headersPolyfill.Headers({
    "Content-Type": "application/json",
    Authorization: params.authToken
  });
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`muteSpeaker => ${resp.status} ${text}`);
  }
}
async function unmuteSpeaker(params) {
  const url = "https://guest.pscp.tv/api/v1/audiospace/unmuteSpeaker";
  const body = {
    ntpForBroadcasterFrame: 2208988800031e6,
    ntpForLiveFrame: 2208988800031e6,
    session_uuid: params.sessionUUID ?? "",
    broadcast_id: params.broadcastId,
    chat_token: params.chatToken
  };
  const headers = new headersPolyfill.Headers({
    "Content-Type": "application/json",
    Authorization: params.authToken
  });
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`unmuteSpeaker => ${resp.status} ${text}`);
  }
}
function setupCommonChatEvents(chatClient, logger, emitter) {
  chatClient.on("occupancyUpdate", (upd) => {
    logger.debug("[ChatEvents] occupancyUpdate =>", upd);
    emitter.emit("occupancyUpdate", upd);
  });
  chatClient.on("guestReaction", (reaction) => {
    logger.debug("[ChatEvents] guestReaction =>", reaction);
    emitter.emit("guestReaction", reaction);
  });
  chatClient.on("muteStateChanged", (evt) => {
    logger.debug("[ChatEvents] muteStateChanged =>", evt);
    emitter.emit("muteStateChanged", evt);
  });
  chatClient.on("speakerRequest", (req) => {
    logger.debug("[ChatEvents] speakerRequest =>", req);
    emitter.emit("speakerRequest", req);
  });
  chatClient.on("newSpeakerAccepted", (info) => {
    logger.debug("[ChatEvents] newSpeakerAccepted =>", info);
    emitter.emit("newSpeakerAccepted", info);
  });
}

class Logger {
  constructor(debugEnabled) {
    this.debugEnabled = debugEnabled;
  }
  info(msg, ...args) {
    console.log(msg, ...args);
  }
  debug(msg, ...args) {
    if (this.debugEnabled) {
      console.log(msg, ...args);
    }
  }
  warn(msg, ...args) {
    console.warn("[WARN]", msg, ...args);
  }
  error(msg, ...args) {
    console.error(msg, ...args);
  }
  isDebugEnabled() {
    return this.debugEnabled;
  }
}

class Space extends events.EventEmitter {
  constructor(scraper, options) {
    super();
    this.scraper = scraper;
    this.isInitialized = false;
    this.plugins = /* @__PURE__ */ new Set();
    this.speakers = /* @__PURE__ */ new Map();
    this.debug = options?.debug ?? false;
    this.logger = new Logger(this.debug);
  }
  /**
   * Registers a plugin and calls its onAttach(...).
   * init(...) will be invoked once initialization is complete.
   */
  use(plugin, config) {
    const registration = { plugin, config };
    this.plugins.add(registration);
    this.logger.debug("[Space] Plugin added =>", plugin.constructor.name);
    plugin.onAttach?.({ space: this, pluginConfig: config });
    if (this.isInitialized && plugin.init) {
      plugin.init({ space: this, pluginConfig: config });
      if (this.janusClient) {
        plugin.onJanusReady?.(this.janusClient);
      }
    }
    return this;
  }
  /**
   * Main entry point to create and initialize the Space broadcast.
   */
  async initialize(config) {
    this.logger.debug("[Space] Initializing...");
    const cookie = await this.scraper.getPeriscopeCookie();
    const region = await getRegion();
    this.logger.debug("[Space] Got region =>", region);
    this.logger.debug("[Space] Creating broadcast...");
    const broadcast = await createBroadcast({
      description: config.description,
      languages: config.languages,
      cookie,
      region,
      record: config.record
    });
    this.broadcastInfo = broadcast;
    this.logger.debug("[Space] Authorizing token...");
    this.authToken = await authorizeToken(cookie);
    this.logger.debug("[Space] Getting turn servers...");
    const turnServers = await getTurnServers(cookie);
    this.janusClient = new JanusClient({
      webrtcUrl: broadcast.webrtc_gw_url,
      roomId: broadcast.room_id,
      credential: broadcast.credential,
      userId: broadcast.broadcast.user_id,
      streamName: broadcast.stream_name,
      turnServers,
      logger: this.logger
    });
    await this.janusClient.initialize();
    this.janusClient.on("audioDataFromSpeaker", (data) => {
      this.logger.debug("[Space] Received PCM from speaker =>", data.userId);
      this.handleAudioData(data);
    });
    this.janusClient.on("subscribedSpeaker", ({ userId, feedId }) => {
      const speaker = this.speakers.get(userId);
      if (!speaker) {
        this.logger.debug(
          "[Space] subscribedSpeaker => no speaker found",
          userId
        );
        return;
      }
      speaker.janusParticipantId = feedId;
      this.logger.debug(
        `[Space] updated speaker => userId=${userId}, feedId=${feedId}`
      );
    });
    this.logger.debug("[Space] Publishing broadcast...");
    await publishBroadcast({
      title: config.title || "",
      broadcast,
      cookie,
      janusSessionId: this.janusClient.getSessionId(),
      janusHandleId: this.janusClient.getHandleId(),
      janusPublisherId: this.janusClient.getPublisherId()
    });
    if (config.mode === "INTERACTIVE") {
      this.logger.debug("[Space] Connecting chat...");
      this.chatClient = new ChatClient({
        spaceId: broadcast.room_id,
        accessToken: broadcast.access_token,
        endpoint: broadcast.endpoint,
        logger: this.logger
      });
      await this.chatClient.connect();
      this.setupChatEvents();
    }
    this.logger.info(
      "[Space] Initialized =>",
      broadcast.share_url.replace("broadcasts", "spaces")
    );
    this.isInitialized = true;
    for (const { plugin, config: pluginConfig } of this.plugins) {
      plugin.init?.({ space: this, pluginConfig });
      plugin.onJanusReady?.(this.janusClient);
    }
    this.logger.debug("[Space] All plugins initialized");
    return broadcast;
  }
  /**
   * Send an emoji reaction via chat, if interactive.
   */
  reactWithEmoji(emoji) {
    if (!this.chatClient) return;
    this.chatClient.reactWithEmoji(emoji);
  }
  /**
   * Internal method to wire up chat events if interactive.
   */
  setupChatEvents() {
    if (!this.chatClient) return;
    setupCommonChatEvents(this.chatClient, this.logger, this);
  }
  /**
   * Approves a speaker request on Twitter side, then calls Janus to subscribe their audio.
   */
  async approveSpeaker(userId, sessionUUID) {
    if (!this.isInitialized || !this.broadcastInfo) {
      throw new Error("[Space] Not initialized or missing broadcastInfo");
    }
    if (!this.authToken) {
      throw new Error("[Space] No auth token available");
    }
    this.speakers.set(userId, { userId, sessionUUID });
    await this.callApproveEndpoint(
      this.broadcastInfo,
      this.authToken,
      userId,
      sessionUUID
    );
    await this.janusClient?.subscribeSpeaker(userId);
  }
  /**
   * Approve request => calls /api/v1/audiospace/request/approve
   */
  async callApproveEndpoint(broadcast, authorizationToken, userId, sessionUUID) {
    const endpoint = "https://guest.pscp.tv/api/v1/audiospace/request/approve";
    const headers = {
      "Content-Type": "application/json",
      Referer: "https://x.com/",
      Authorization: authorizationToken
    };
    const body = {
      ntpForBroadcasterFrame: "2208988800024000300",
      ntpForLiveFrame: "2208988800024000300",
      chat_token: broadcast.access_token,
      session_uuid: sessionUUID
    };
    this.logger.debug("[Space] Approving speaker =>", endpoint, body);
    const resp = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const error = await resp.text();
      throw new Error(
        `[Space] Failed to approve speaker => ${resp.status}: ${error}`
      );
    }
    this.logger.info("[Space] Speaker approved =>", userId);
  }
  /**
   * Removes a speaker from the Twitter side, then unsubscribes in Janus if needed.
   */
  async removeSpeaker(userId) {
    if (!this.isInitialized || !this.broadcastInfo) {
      throw new Error("[Space] Not initialized or missing broadcastInfo");
    }
    if (!this.authToken) {
      throw new Error("[Space] No auth token");
    }
    if (!this.janusClient) {
      throw new Error("[Space] No Janus client");
    }
    const speaker = this.speakers.get(userId);
    if (!speaker) {
      throw new Error(
        `[Space] removeSpeaker => no speaker found for userId=${userId}`
      );
    }
    const { sessionUUID, janusParticipantId } = speaker;
    this.logger.debug(
      "[Space] removeSpeaker =>",
      sessionUUID,
      janusParticipantId,
      speaker
    );
    if (!sessionUUID || janusParticipantId === void 0) {
      throw new Error(
        `[Space] removeSpeaker => missing sessionUUID or feedId for userId=${userId}`
      );
    }
    const janusHandleId = this.janusClient.getHandleId();
    const janusSessionId = this.janusClient.getSessionId();
    if (!janusHandleId || !janusSessionId) {
      throw new Error(
        `[Space] removeSpeaker => missing Janus handle/session for userId=${userId}`
      );
    }
    await this.callRemoveEndpoint(
      this.broadcastInfo,
      this.authToken,
      sessionUUID,
      janusParticipantId,
      this.broadcastInfo.room_id,
      janusHandleId,
      janusSessionId
    );
    this.speakers.delete(userId);
    this.logger.info(`[Space] removeSpeaker => removed userId=${userId}`);
  }
  /**
   * Twitter's /api/v1/audiospace/stream/eject call
   */
  async callRemoveEndpoint(broadcast, authorizationToken, sessionUUID, janusParticipantId, janusRoomId, webrtcHandleId, webrtcSessionId) {
    const endpoint = "https://guest.pscp.tv/api/v1/audiospace/stream/eject";
    const headers = {
      "Content-Type": "application/json",
      Referer: "https://x.com/",
      Authorization: authorizationToken
    };
    const body = {
      ntpForBroadcasterFrame: "2208988800024000300",
      ntpForLiveFrame: "2208988800024000300",
      session_uuid: sessionUUID,
      chat_token: broadcast.access_token,
      janus_room_id: janusRoomId,
      janus_participant_id: janusParticipantId,
      webrtc_handle_id: webrtcHandleId,
      webrtc_session_id: webrtcSessionId
    };
    this.logger.debug("[Space] Removing speaker =>", endpoint, body);
    const resp = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const error = await resp.text();
      throw new Error(
        `[Space] Failed to remove speaker => ${resp.status}: ${error}`
      );
    }
    this.logger.debug("[Space] Speaker removed => sessionUUID=", sessionUUID);
  }
  /**
   * Push PCM audio frames if you're the host. Usually you'd do this if you're capturing
   * microphone input from the host side.
   */
  pushAudio(samples, sampleRate) {
    this.janusClient?.pushLocalAudio(samples, sampleRate);
  }
  /**
   * Handler for PCM from other speakers, forwarded to plugin.onAudioData
   */
  handleAudioData(data) {
    for (const { plugin } of this.plugins) {
      plugin.onAudioData?.(data);
    }
  }
  /**
   * Gracefully shut down this Space: destroy the Janus room, end the broadcast, etc.
   */
  async finalizeSpace() {
    this.logger.info("[Space] finalizeSpace => stopping broadcast gracefully");
    const tasks = [];
    if (this.janusClient) {
      tasks.push(
        this.janusClient.destroyRoom().catch((err) => {
          this.logger.error("[Space] destroyRoom error =>", err);
        })
      );
    }
    if (this.broadcastInfo) {
      tasks.push(
        this.endAudiospace({
          broadcastId: this.broadcastInfo.room_id,
          chatToken: this.broadcastInfo.access_token
        }).catch((err) => {
          this.logger.error("[Space] endAudiospace error =>", err);
        })
      );
    }
    if (this.janusClient) {
      tasks.push(
        this.janusClient.leaveRoom().catch((err) => {
          this.logger.error("[Space] leaveRoom error =>", err);
        })
      );
    }
    await Promise.all(tasks);
    this.logger.info("[Space] finalizeSpace => done.");
  }
  /**
   * Calls /api/v1/audiospace/admin/endAudiospace on Twitter side.
   */
  async endAudiospace(params) {
    const url = "https://guest.pscp.tv/api/v1/audiospace/admin/endAudiospace";
    const headers = {
      "Content-Type": "application/json",
      Referer: "https://x.com/",
      Authorization: this.authToken || ""
    };
    const body = {
      broadcast_id: params.broadcastId,
      chat_token: params.chatToken
    };
    this.logger.debug("[Space] endAudiospace =>", body);
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`[Space] endAudiospace => ${resp.status} ${errText}`);
    }
    const json = await resp.json();
    this.logger.debug("[Space] endAudiospace => success =>", json);
  }
  /**
   * Retrieves an array of known speakers in this Space (by userId and sessionUUID).
   */
  getSpeakers() {
    return Array.from(this.speakers.values());
  }
  /**
   * Mute the host (yourself). For the host, session_uuid = '' (empty).
   */
  async muteHost() {
    if (!this.authToken) {
      throw new Error("[Space] No auth token available");
    }
    if (!this.broadcastInfo) {
      throw new Error("[Space] No broadcastInfo");
    }
    await muteSpeaker({
      broadcastId: this.broadcastInfo.room_id,
      sessionUUID: "",
      // host => empty
      chatToken: this.broadcastInfo.access_token,
      authToken: this.authToken
    });
    this.logger.info("[Space] Host muted successfully.");
  }
  /**
   * Unmute the host (yourself).
   */
  async unmuteHost() {
    if (!this.authToken) {
      throw new Error("[Space] No auth token");
    }
    if (!this.broadcastInfo) {
      throw new Error("[Space] No broadcastInfo");
    }
    await unmuteSpeaker({
      broadcastId: this.broadcastInfo.room_id,
      sessionUUID: "",
      chatToken: this.broadcastInfo.access_token,
      authToken: this.authToken
    });
    this.logger.info("[Space] Host unmuted successfully.");
  }
  /**
   * Mute a specific speaker. We'll retrieve sessionUUID from our local map.
   */
  async muteSpeaker(userId) {
    if (!this.authToken) {
      throw new Error("[Space] No auth token available");
    }
    if (!this.broadcastInfo) {
      throw new Error("[Space] No broadcastInfo");
    }
    const speaker = this.speakers.get(userId);
    if (!speaker) {
      throw new Error(`[Space] Speaker not found for userId=${userId}`);
    }
    await muteSpeaker({
      broadcastId: this.broadcastInfo.room_id,
      sessionUUID: speaker.sessionUUID,
      chatToken: this.broadcastInfo.access_token,
      authToken: this.authToken
    });
    this.logger.info(`[Space] Muted speaker => userId=${userId}`);
  }
  /**
   * Unmute a specific speaker. We'll retrieve sessionUUID from local map.
   */
  async unmuteSpeaker(userId) {
    if (!this.authToken) {
      throw new Error("[Space] No auth token available");
    }
    if (!this.broadcastInfo) {
      throw new Error("[Space] No broadcastInfo");
    }
    const speaker = this.speakers.get(userId);
    if (!speaker) {
      throw new Error(`[Space] Speaker not found for userId=${userId}`);
    }
    await unmuteSpeaker({
      broadcastId: this.broadcastInfo.room_id,
      sessionUUID: speaker.sessionUUID,
      chatToken: this.broadcastInfo.access_token,
      authToken: this.authToken
    });
    this.logger.info(`[Space] Unmuted speaker => userId=${userId}`);
  }
  /**
   * Stop the broadcast entirely, performing finalizeSpace() plus plugin cleanup.
   */
  async stop() {
    this.logger.info("[Space] Stopping...");
    await this.finalizeSpace().catch((err) => {
      this.logger.error("[Space] finalizeBroadcast error =>", err);
    });
    if (this.chatClient) {
      await this.chatClient.disconnect();
      this.chatClient = void 0;
    }
    if (this.janusClient) {
      await this.janusClient.stop();
      this.janusClient = void 0;
    }
    for (const { plugin } of this.plugins) {
      plugin.cleanup?.();
    }
    this.plugins.clear();
    this.isInitialized = false;
  }
}

class SpaceParticipant extends events.EventEmitter {
  constructor(scraper, config) {
    super();
    this.scraper = scraper;
    // Plugin management
    this.plugins = /* @__PURE__ */ new Set();
    this.spaceId = config.spaceId;
    this.debug = config.debug ?? false;
    this.logger = new Logger(this.debug);
  }
  /**
   * Adds a plugin and calls its onAttach immediately.
   * init() or onJanusReady() will be invoked later at the appropriate time.
   */
  use(plugin, config) {
    const registration = { plugin, config };
    this.plugins.add(registration);
    this.logger.debug(
      "[SpaceParticipant] Plugin added =>",
      plugin.constructor.name
    );
    plugin.onAttach?.({ space: this, pluginConfig: config });
    return this;
  }
  /**
   * Joins the Space as a listener: obtains HLS, chat token, etc.
   */
  async joinAsListener() {
    this.logger.info(
      "[SpaceParticipant] Joining space as listener =>",
      this.spaceId
    );
    this.cookie = await this.scraper.getPeriscopeCookie();
    this.authToken = await authorizeToken(this.cookie);
    const spaceMeta = await this.scraper.getAudioSpaceById(this.spaceId);
    const mediaKey = spaceMeta?.metadata?.media_key;
    if (!mediaKey) {
      throw new Error("[SpaceParticipant] No mediaKey found in metadata");
    }
    this.logger.debug("[SpaceParticipant] mediaKey =>", mediaKey);
    const status = await this.scraper.getAudioSpaceStreamStatus(mediaKey);
    this.hlsUrl = status?.source?.location;
    this.chatJwtToken = status?.chatToken;
    this.lifecycleToken = status?.lifecycleToken;
    this.logger.debug("[SpaceParticipant] HLS =>", this.hlsUrl);
    if (!this.chatJwtToken) {
      throw new Error("[SpaceParticipant] No chatToken found");
    }
    const chatInfo = await accessChat(this.chatJwtToken, this.cookie);
    this.chatToken = chatInfo.access_token;
    this.chatClient = new ChatClient({
      spaceId: chatInfo.room_id,
      accessToken: chatInfo.access_token,
      endpoint: chatInfo.endpoint,
      logger: this.logger
    });
    await this.chatClient.connect();
    this.setupChatEvents();
    this.watchSession = await startWatching(this.lifecycleToken, this.cookie);
    this.logger.info("[SpaceParticipant] Joined as listener.");
    for (const { plugin, config } of this.plugins) {
      plugin.init?.({ space: this, pluginConfig: config });
    }
  }
  /**
   * Returns the HLS URL if you want to consume the stream as a listener.
   */
  getHlsUrl() {
    return this.hlsUrl;
  }
  /**
   * Submits a speaker request using /audiospace/request/submit.
   * Returns the sessionUUID used to track approval.
   */
  async requestSpeaker() {
    if (!this.chatJwtToken) {
      throw new Error(
        "[SpaceParticipant] Must join as listener first (no chat token)."
      );
    }
    if (!this.authToken) {
      throw new Error("[SpaceParticipant] No auth token available.");
    }
    if (!this.chatToken) {
      throw new Error("[SpaceParticipant] No chat token available.");
    }
    this.logger.info("[SpaceParticipant] Submitting speaker request...");
    const { session_uuid } = await submitSpeakerRequest({
      broadcastId: this.spaceId,
      chatToken: this.chatToken,
      authToken: this.authToken
    });
    this.sessionUUID = session_uuid;
    this.logger.info(
      "[SpaceParticipant] Speaker request submitted =>",
      session_uuid
    );
    return { sessionUUID: session_uuid };
  }
  /**
   * Cancels a previously submitted speaker request using /audiospace/request/cancel.
   * This requires a valid sessionUUID from requestSpeaker() first.
   */
  async cancelSpeakerRequest() {
    if (!this.sessionUUID) {
      throw new Error(
        "[SpaceParticipant] No sessionUUID; cannot cancel a speaker request that was never submitted."
      );
    }
    if (!this.authToken) {
      throw new Error("[SpaceParticipant] No auth token available.");
    }
    if (!this.chatToken) {
      throw new Error("[SpaceParticipant] No chat token available.");
    }
    await cancelSpeakerRequest({
      broadcastId: this.spaceId,
      sessionUUID: this.sessionUUID,
      chatToken: this.chatToken,
      authToken: this.authToken
    });
    this.logger.info(
      "[SpaceParticipant] Speaker request canceled =>",
      this.sessionUUID
    );
    this.sessionUUID = void 0;
  }
  /**
   * Once the host approves our speaker request, we perform Janus negotiation
   * to become a speaker.
   */
  async becomeSpeaker() {
    if (!this.sessionUUID) {
      throw new Error(
        "[SpaceParticipant] No sessionUUID (did you call requestSpeaker()?)."
      );
    }
    this.logger.info(
      "[SpaceParticipant] Negotiating speaker role via Janus..."
    );
    const turnServers = await getTurnServers(this.cookie);
    this.logger.debug("[SpaceParticipant] turnServers =>", turnServers);
    const nego = await negotiateGuestStream({
      broadcastId: this.spaceId,
      sessionUUID: this.sessionUUID,
      authToken: this.authToken,
      cookie: this.cookie
    });
    this.janusJwt = nego.janus_jwt;
    this.webrtcGwUrl = nego.webrtc_gw_url;
    this.logger.debug("[SpaceParticipant] webrtcGwUrl =>", this.webrtcGwUrl);
    this.janusClient = new JanusClient({
      webrtcUrl: this.webrtcGwUrl,
      roomId: this.spaceId,
      credential: this.janusJwt,
      userId: turnServers.username.split(":")[1],
      streamName: this.spaceId,
      turnServers,
      logger: this.logger
    });
    await this.janusClient.initializeGuestSpeaker(this.sessionUUID);
    this.janusClient.on("audioDataFromSpeaker", (data) => {
      this.logger.debug(
        "[SpaceParticipant] Received speaker audio =>",
        data.userId
      );
      this.handleAudioData(data);
    });
    this.logger.info(
      "[SpaceParticipant] Now speaker on the Space =>",
      this.spaceId
    );
    for (const { plugin } of this.plugins) {
      plugin.onJanusReady?.(this.janusClient);
    }
  }
  /**
   * Leaves the Space gracefully:
   * - Stop Janus if we were a speaker
   * - Stop watching as a viewer
   * - Disconnect chat
   */
  async leaveSpace() {
    this.logger.info("[SpaceParticipant] Leaving space...");
    if (this.janusClient) {
      await this.janusClient.stop();
      this.janusClient = void 0;
    }
    if (this.watchSession && this.cookie) {
      await stopWatching(this.watchSession, this.cookie);
    }
    if (this.chatClient) {
      await this.chatClient.disconnect();
      this.chatClient = void 0;
    }
    this.logger.info("[SpaceParticipant] Left space =>", this.spaceId);
  }
  /**
   * Pushes PCM audio frames if we're speaker; otherwise logs a warning.
   */
  pushAudio(samples, sampleRate) {
    if (!this.janusClient) {
      this.logger.warn(
        "[SpaceParticipant] Not a speaker yet; ignoring pushAudio."
      );
      return;
    }
    this.janusClient.pushLocalAudio(samples, sampleRate);
  }
  /**
   * Internal handler for incoming PCM frames from Janus, forwarded to plugin.onAudioData if present.
   */
  handleAudioData(data) {
    for (const { plugin } of this.plugins) {
      plugin.onAudioData?.(data);
    }
  }
  /**
   * Sets up chat events: "occupancyUpdate", "newSpeakerAccepted", etc.
   */
  setupChatEvents() {
    if (!this.chatClient) return;
    setupCommonChatEvents(this.chatClient, this.logger, this);
    this.chatClient.on("newSpeakerAccepted", ({ userId }) => {
      this.logger.debug("[SpaceParticipant] newSpeakerAccepted =>", userId);
      if (!this.janusClient) {
        this.logger.warn(
          "[SpaceParticipant] No janusClient yet; ignoring new speaker..."
        );
        return;
      }
      if (userId === this.janusClient.getHandleId()) {
        return;
      }
      this.janusClient.subscribeSpeaker(userId).catch((err) => {
        this.logger.error("[SpaceParticipant] subscribeSpeaker error =>", err);
      });
    });
  }
  /**
   * Mute self if we are speaker: calls /audiospace/muteSpeaker with our sessionUUID.
   */
  async muteSelf() {
    if (!this.authToken || !this.chatToken) {
      throw new Error("[SpaceParticipant] Missing authToken or chatToken.");
    }
    if (!this.sessionUUID) {
      throw new Error("[SpaceParticipant] No sessionUUID; are you a speaker?");
    }
    await muteSpeaker({
      broadcastId: this.spaceId,
      sessionUUID: this.sessionUUID,
      chatToken: this.chatToken,
      authToken: this.authToken
    });
    this.logger.info("[SpaceParticipant] Successfully muted self.");
  }
  /**
   * Unmute self if we are speaker: calls /audiospace/unmuteSpeaker with our sessionUUID.
   */
  async unmuteSelf() {
    if (!this.authToken || !this.chatToken) {
      throw new Error("[SpaceParticipant] Missing authToken or chatToken.");
    }
    if (!this.sessionUUID) {
      throw new Error("[SpaceParticipant] No sessionUUID; are you a speaker?");
    }
    await unmuteSpeaker({
      broadcastId: this.spaceId,
      sessionUUID: this.sessionUUID,
      chatToken: this.chatToken,
      authToken: this.authToken
    });
    this.logger.info("[SpaceParticipant] Successfully unmuted self.");
  }
}

class SttTtsPlugin {
  constructor() {
    this.sttLanguage = "en";
    this.gptModel = "gpt-3.5-turbo";
    this.voiceId = "21m00Tcm4TlvDq8ikWAM";
    this.elevenLabsModel = "eleven_monolingual_v1";
    this.systemPrompt = "You are a helpful AI assistant.";
    this.silenceThreshold = 50;
    /**
     * chatContext accumulates the conversation for GPT:
     *  - system: persona instructions
     *  - user/assistant: running conversation
     */
    this.chatContext = [];
    /**
     * Maps each userId => array of Int16Array PCM chunks
     * Only accumulates data if the speaker is unmuted
     */
    this.pcmBuffers = /* @__PURE__ */ new Map();
    /**
     * Tracks which speakers are currently unmuted:
     * userId => true/false
     */
    this.speakerUnmuted = /* @__PURE__ */ new Map();
    /**
     * TTS queue for sequential playback
     */
    this.ttsQueue = [];
    this.isSpeaking = false;
  }
  /**
   * Called immediately after `.use(plugin)`.
   * Usually used for storing references or minimal setup.
   */
  onAttach(params) {
    this.spaceOrParticipant = params.space;
    const debugEnabled = params.pluginConfig?.debug ?? false;
    this.logger = new Logger(debugEnabled);
    console.log("[SttTtsPlugin] onAttach => plugin attached");
  }
  /**
   * Called after the space/participant has joined in basic mode (listener + chat).
   * This is where we can finalize setup that doesn't require Janus or speaker mode.
   */
  init(params) {
    const config = params.pluginConfig;
    this.logger?.debug("[SttTtsPlugin] init => finalizing basic setup");
    this.spaceOrParticipant = params.space;
    this.janus = this.spaceOrParticipant.janusClient;
    this.openAiApiKey = config?.openAiApiKey;
    this.elevenLabsApiKey = config?.elevenLabsApiKey;
    if (config?.sttLanguage) this.sttLanguage = config.sttLanguage;
    if (config?.gptModel) this.gptModel = config.gptModel;
    if (typeof config?.silenceThreshold === "number") {
      this.silenceThreshold = config.silenceThreshold;
    }
    if (config?.voiceId) this.voiceId = config.voiceId;
    if (config?.elevenLabsModel) this.elevenLabsModel = config.elevenLabsModel;
    if (config?.systemPrompt) this.systemPrompt = config.systemPrompt;
    if (config?.chatContext) {
      this.chatContext = config.chatContext;
    }
    this.logger?.debug("[SttTtsPlugin] Merged config =>", config);
    this.spaceOrParticipant.on(
      "muteStateChanged",
      (evt) => {
        this.logger?.debug("[SttTtsPlugin] muteStateChanged =>", evt);
        if (evt.muted) {
          this.handleMute(evt.userId).catch((err) => {
            this.logger?.error("[SttTtsPlugin] handleMute error =>", err);
          });
        } else {
          this.speakerUnmuted.set(evt.userId, true);
          if (!this.pcmBuffers.has(evt.userId)) {
            this.pcmBuffers.set(evt.userId, []);
          }
        }
      }
    );
  }
  /**
   * Called if/when the plugin needs direct access to a JanusClient.
   * For example, once the participant becomes a speaker or if a host
   * has finished setting up Janus.
   */
  onJanusReady(janusClient) {
    this.logger?.debug(
      "[SttTtsPlugin] onJanusReady => JanusClient is now available"
    );
    this.janus = janusClient;
  }
  /**
   * onAudioData: triggered for every incoming PCM frame from a speaker.
   * We'll accumulate them if that speaker is currently unmuted.
   */
  onAudioData(data) {
    const { userId, samples } = data;
    if (!this.speakerUnmuted.get(userId)) return;
    let maxVal = 0;
    for (let i = 0; i < samples.length; i++) {
      const val = Math.abs(samples[i]);
      if (val > maxVal) maxVal = val;
    }
    if (maxVal < this.silenceThreshold) return;
    const chunks = this.pcmBuffers.get(userId) ?? [];
    chunks.push(samples);
    this.pcmBuffers.set(userId, chunks);
  }
  /**
   * handleMute: called when a speaker goes from unmuted to muted.
   * We'll flush their collected PCM => STT => GPT => TTS => push to Janus
   */
  async handleMute(userId) {
    this.speakerUnmuted.set(userId, false);
    const chunks = this.pcmBuffers.get(userId) || [];
    this.pcmBuffers.set(userId, []);
    if (!chunks.length) {
      this.logger?.debug("[SttTtsPlugin] No audio data => userId=", userId);
      return;
    }
    this.logger?.info(
      `[SttTtsPlugin] Flushing STT buffer => userId=${userId}, chunkCount=${chunks.length}`
    );
    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const merged = new Int16Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    const wavPath = await this.convertPcmToWav(merged, 48e3);
    this.logger?.debug("[SttTtsPlugin] WAV created =>", wavPath);
    const sttText = await this.transcribeWithOpenAI(wavPath, this.sttLanguage);
    fs.unlinkSync(wavPath);
    if (!sttText.trim()) {
      this.logger?.debug(
        "[SttTtsPlugin] No speech recognized => userId=",
        userId
      );
      return;
    }
    this.logger?.info(
      `[SttTtsPlugin] STT => userId=${userId}, text="${sttText}"`
    );
    const replyText = await this.askChatGPT(sttText);
    this.logger?.info(
      `[SttTtsPlugin] GPT => userId=${userId}, reply="${replyText}"`
    );
    await this.speakText(replyText);
  }
  /**
   * speakText: Public method to enqueue a text message for TTS output
   */
  async speakText(text) {
    this.ttsQueue.push(text);
    if (!this.isSpeaking) {
      this.isSpeaking = true;
      this.processTtsQueue().catch((err) => {
        this.logger?.error("[SttTtsPlugin] processTtsQueue error =>", err);
      });
    }
  }
  /**
   * processTtsQueue: Drains the TTS queue in order, sending frames to Janus
   */
  async processTtsQueue() {
    while (this.ttsQueue.length > 0) {
      const text = this.ttsQueue.shift();
      if (!text) continue;
      try {
        const mp3Buf = await this.elevenLabsTts(text);
        const pcm = await this.convertMp3ToPcm(mp3Buf, 48e3);
        await this.streamToJanus(pcm, 48e3);
      } catch (err) {
        this.logger?.error("[SttTtsPlugin] TTS streaming error =>", err);
      }
    }
    this.isSpeaking = false;
  }
  /**
   * convertPcmToWav: Creates a temporary WAV file from raw PCM samples
   */
  convertPcmToWav(samples, sampleRate) {
    return new Promise((resolve, reject) => {
      const tmpPath = path.resolve("/tmp", `stt-${Date.now()}.wav`);
      const ff = child_process.spawn("ffmpeg", [
        "-f",
        "s16le",
        "-ar",
        sampleRate.toString(),
        "-ac",
        "1",
        "-i",
        "pipe:0",
        "-y",
        tmpPath
      ]);
      ff.stdin.write(Buffer.from(samples.buffer));
      ff.stdin.end();
      ff.on("close", (code) => {
        if (code === 0) {
          resolve(tmpPath);
        } else {
          reject(new Error(`ffmpeg pcm->wav error code=${code}`));
        }
      });
    });
  }
  /**
   * transcribeWithOpenAI: sends the WAV file to OpenAI Whisper
   */
  async transcribeWithOpenAI(wavPath, language) {
    if (!this.openAiApiKey) {
      throw new Error("[SttTtsPlugin] No OpenAI API key");
    }
    this.logger?.info("[SttTtsPlugin] Transcribing =>", wavPath);
    const fileBuffer = fs.readFileSync(wavPath);
    this.logger?.debug("[SttTtsPlugin] WAV size =>", fileBuffer.length);
    const blob = new Blob([fileBuffer], { type: "audio/wav" });
    const formData = new FormData();
    formData.append("file", blob, path.basename(wavPath));
    formData.append("model", "whisper-1");
    formData.append("language", language);
    formData.append("temperature", "0");
    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.openAiApiKey}` },
      body: formData
    });
    if (!resp.ok) {
      const errText = await resp.text();
      this.logger?.error("[SttTtsPlugin] OpenAI STT error =>", errText);
      throw new Error(`OpenAI STT => ${resp.status} ${errText}`);
    }
    const data = await resp.json();
    return data.text.trim();
  }
  /**
   * askChatGPT: sends user text to GPT, returns the assistant reply
   */
  async askChatGPT(userText) {
    if (!this.openAiApiKey) {
      throw new Error("[SttTtsPlugin] No OpenAI API key (GPT) provided");
    }
    const messages = [
      { role: "system", content: this.systemPrompt },
      ...this.chatContext,
      { role: "user", content: userText }
    ];
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.openAiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ model: this.gptModel, messages })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(
        `[SttTtsPlugin] ChatGPT error => ${resp.status} ${errText}`
      );
    }
    const json = await resp.json();
    const reply = json.choices?.[0]?.message?.content || "";
    this.chatContext.push({ role: "user", content: userText });
    this.chatContext.push({ role: "assistant", content: reply });
    return reply.trim();
  }
  /**
   * elevenLabsTts: fetches MP3 audio from ElevenLabs for a given text
   */
  async elevenLabsTts(text) {
    if (!this.elevenLabsApiKey) {
      throw new Error("[SttTtsPlugin] No ElevenLabs API key");
    }
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": this.elevenLabsApiKey
      },
      body: JSON.stringify({
        text,
        model_id: this.elevenLabsModel,
        voice_settings: { stability: 0.4, similarity_boost: 0.8 }
      })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(
        `[SttTtsPlugin] ElevenLabs error => ${resp.status} ${errText}`
      );
    }
    const arrayBuffer = await resp.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  /**
   * convertMp3ToPcm: uses ffmpeg to convert an MP3 buffer to raw PCM
   */
  convertMp3ToPcm(mp3Buf, outRate) {
    return new Promise((resolve, reject) => {
      const ff = child_process.spawn("ffmpeg", [
        "-i",
        "pipe:0",
        "-f",
        "s16le",
        "-ar",
        outRate.toString(),
        "-ac",
        "1",
        "pipe:1"
      ]);
      let raw = Buffer.alloc(0);
      ff.stdout.on("data", (chunk) => {
        raw = Buffer.concat([raw, chunk]);
      });
      ff.stderr.on("data", () => {
      });
      ff.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`ffmpeg mp3->pcm error code=${code}`));
          return;
        }
        const samples = new Int16Array(
          raw.buffer,
          raw.byteOffset,
          raw.byteLength / 2
        );
        resolve(samples);
      });
      ff.stdin.write(mp3Buf);
      ff.stdin.end();
    });
  }
  /**
   * streamToJanus: push PCM frames to Janus in small increments (~10ms).
   */
  async streamToJanus(samples, sampleRate) {
    if (!this.janus) {
      this.logger?.warn(
        "[SttTtsPlugin] No JanusClient available, cannot send TTS audio"
      );
      return;
    }
    const frameSize = Math.floor(sampleRate * 0.01);
    for (let offset = 0; offset + frameSize <= samples.length; offset += frameSize) {
      const frame = new Int16Array(frameSize);
      frame.set(samples.subarray(offset, offset + frameSize));
      this.janus.pushLocalAudio(frame, sampleRate, 1);
      await new Promise((r) => setTimeout(r, 10));
    }
  }
  /**
   * setSystemPrompt: update the GPT system prompt at runtime
   */
  setSystemPrompt(prompt) {
    this.systemPrompt = prompt;
    this.logger?.info("[SttTtsPlugin] setSystemPrompt =>", prompt);
  }
  /**
   * setGptModel: switch GPT model (e.g. "gpt-4")
   */
  setGptModel(model) {
    this.gptModel = model;
    this.logger?.info("[SttTtsPlugin] setGptModel =>", model);
  }
  /**
   * addMessage: manually add a system/user/assistant message to the chat context
   */
  addMessage(role, content) {
    this.chatContext.push({ role, content });
    this.logger?.debug(
      `[SttTtsPlugin] addMessage => role=${role}, content="${content}"`
    );
  }
  /**
   * clearChatContext: resets the GPT conversation
   */
  clearChatContext() {
    this.chatContext = [];
    this.logger?.debug("[SttTtsPlugin] clearChatContext => done");
  }
  /**
   * cleanup: release resources when the space/participant is stopping or plugin removed
   */
  cleanup() {
    this.logger?.info("[SttTtsPlugin] cleanup => releasing resources");
    this.pcmBuffers.clear();
    this.speakerUnmuted.clear();
    this.ttsQueue = [];
    this.isSpeaking = false;
  }
}

class RecordToDiskPlugin {
  constructor() {
    this.filePath = "/tmp/speaker_audio.raw";
  }
  /**
   * Called immediately after .use(plugin).
   * We create a logger based on pluginConfig.debug and store the file path if provided.
   */
  onAttach(params) {
    const debugEnabled = params.pluginConfig?.debug ?? false;
    this.logger = new Logger(debugEnabled);
    this.logger.info("[RecordToDiskPlugin] onAttach => plugin attached");
    if (params.pluginConfig?.filePath) {
      this.filePath = params.pluginConfig.filePath;
    }
    this.logger.debug("[RecordToDiskPlugin] Using filePath =>", this.filePath);
  }
  /**
   * Called after the space/participant has joined in basic mode.
   * We open the WriteStream to our file path here.
   */
  init(params) {
    if (params.pluginConfig?.filePath) {
      this.filePath = params.pluginConfig.filePath;
    }
    this.logger?.info("[RecordToDiskPlugin] init => opening output stream");
    this.outStream = fs__namespace.createWriteStream(this.filePath, { flags: "w" });
  }
  /**
   * Called whenever PCM audio frames arrive from a speaker.
   * We write them to the file as raw 16-bit PCM.
   */
  onAudioData(data) {
    if (!this.outStream) {
      this.logger?.warn("[RecordToDiskPlugin] No outStream yet; ignoring data");
      return;
    }
    const buf = Buffer.from(data.samples.buffer);
    this.outStream.write(buf);
    this.logger?.debug(
      `[RecordToDiskPlugin] Wrote ${buf.byteLength} bytes from userId=${data.userId} to disk`
    );
  }
  /**
   * Called when the plugin is cleaned up (e.g. space/participant stop).
   * We close our file stream.
   */
  cleanup() {
    this.logger?.info("[RecordToDiskPlugin] cleanup => closing output stream");
    if (this.outStream) {
      this.outStream.end();
      this.outStream = void 0;
    }
  }
}

class MonitorAudioPlugin {
  /**
   * @param sampleRate  The expected PCM sample rate (e.g. 16000 or 48000).
   * @param debug       If true, enables debug logging via Logger.
   */
  constructor(sampleRate = 48e3, debug = false) {
    this.sampleRate = sampleRate;
    this.logger = new Logger(debug);
    this.ffplay = child_process.spawn("ffplay", [
      "-f",
      "s16le",
      "-ar",
      this.sampleRate.toString(),
      "-ac",
      "1",
      // mono
      "-nodisp",
      "-loglevel",
      "quiet",
      "-i",
      "pipe:0"
    ]);
    this.ffplay.on("error", (err) => {
      this.logger.error("[MonitorAudioPlugin] ffplay error =>", err);
    });
    this.ffplay.on("close", (code) => {
      this.logger.info("[MonitorAudioPlugin] ffplay closed => code=", code);
      this.ffplay = void 0;
    });
    this.logger.info(
      `[MonitorAudioPlugin] Started ffplay for real-time monitoring (sampleRate=${this.sampleRate})`
    );
  }
  /**
   * Called whenever PCM frames arrive (from a speaker).
   * Writes frames to ffplay's stdin to play them in real time.
   */
  onAudioData(data) {
    this.logger.debug(
      `[MonitorAudioPlugin] onAudioData => userId=${data.userId}, samples=${data.samples.length}, sampleRate=${data.sampleRate}`
    );
    if (!this.ffplay?.stdin.writable) {
      return;
    }
    const pcmBuffer = Buffer.from(data.samples.buffer);
    this.ffplay.stdin.write(pcmBuffer);
  }
  /**
   * Cleanup is called when the plugin is removed or when the space/participant stops.
   * Ends the ffplay process and closes its stdin pipe.
   */
  cleanup() {
    this.logger.info("[MonitorAudioPlugin] Cleanup => stopping ffplay");
    if (this.ffplay) {
      this.ffplay.stdin.end();
      this.ffplay.kill();
      this.ffplay = void 0;
    }
  }
}

class IdleMonitorPlugin {
  /**
   * @param idleTimeoutMs The duration (in ms) of total silence before triggering idle. (Default: 60s)
   * @param checkEveryMs  How frequently (in ms) to check for silence. (Default: 10s)
   */
  constructor(idleTimeoutMs = 6e4, checkEveryMs = 1e4) {
    this.idleTimeoutMs = idleTimeoutMs;
    this.checkEveryMs = checkEveryMs;
    this.lastSpeakerAudioMs = Date.now();
    this.lastLocalAudioMs = Date.now();
  }
  /**
   * Called immediately after .use(plugin).
   * Allows for minimal setup, including obtaining a debug logger if desired.
   */
  onAttach(params) {
    this.space = params.space;
    const debug = params.pluginConfig?.debug ?? false;
    this.logger = new Logger(debug);
    this.logger.info("[IdleMonitorPlugin] onAttach => plugin attached");
  }
  /**
   * Called once the space has fully initialized (basic mode).
   * We set up idle checks and override pushAudio to detect local audio activity.
   */
  init(params) {
    this.space = params.space;
    this.logger?.info("[IdleMonitorPlugin] init => setting up idle checks");
    this.space.on("audioDataFromSpeaker", (_data) => {
      this.lastSpeakerAudioMs = Date.now();
    });
    const originalPushAudio = this.space.pushAudio.bind(this.space);
    this.space.pushAudio = (samples, sampleRate) => {
      this.lastLocalAudioMs = Date.now();
      originalPushAudio(samples, sampleRate);
    };
    this.checkInterval = setInterval(() => this.checkIdle(), this.checkEveryMs);
  }
  /**
   * Checks if we've exceeded idleTimeoutMs with no audio activity.
   * If so, emits an 'idleTimeout' event on the space with { idleMs } info.
   */
  checkIdle() {
    const now = Date.now();
    const lastAudio = Math.max(this.lastSpeakerAudioMs, this.lastLocalAudioMs);
    const idleMs = now - lastAudio;
    if (idleMs >= this.idleTimeoutMs) {
      this.logger?.warn(
        `[IdleMonitorPlugin] idleTimeout => no audio for ${idleMs}ms`
      );
      this.space?.emit("idleTimeout", { idleMs });
    }
  }
  /**
   * Returns how many milliseconds have passed since any audio was detected (local or speaker).
   */
  getIdleTimeMs() {
    const now = Date.now();
    const lastAudio = Math.max(this.lastSpeakerAudioMs, this.lastLocalAudioMs);
    return now - lastAudio;
  }
  /**
   * Cleans up resources (interval) when the plugin is removed or space stops.
   */
  cleanup() {
    this.logger?.info("[IdleMonitorPlugin] cleanup => stopping idle checks");
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = void 0;
    }
  }
}

class HlsRecordPlugin {
  /**
   * You can optionally provide an outputPath in the constructor.
   * Alternatively, it can be set via pluginConfig in onAttach/init.
   */
  constructor(outputPath) {
    this.isRecording = false;
    this.outputPath = outputPath;
  }
  /**
   * Called immediately after .use(plugin). We store references here
   * (e.g., the space) and create a Logger based on pluginConfig.debug.
   */
  onAttach(params) {
    this.space = params.space;
    const debug = params.pluginConfig?.debug ?? false;
    this.logger = new Logger(debug);
    this.logger.info("[HlsRecordPlugin] onAttach => plugin attached");
    if (params.pluginConfig?.outputPath) {
      this.outputPath = params.pluginConfig.outputPath;
    }
  }
  /**
   * Called once the Space has fully initialized (broadcastInfo is ready).
   * We retrieve the media_key from the broadcast, subscribe to occupancy,
   * and prepare for recording if occupancy > 0.
   */
  async init(params) {
    if (params.pluginConfig?.outputPath) {
      this.outputPath = params.pluginConfig.outputPath;
    }
    const broadcastInfo = this.space?.broadcastInfo;
    if (!broadcastInfo || !broadcastInfo.broadcast?.media_key) {
      this.logger?.warn(
        "[HlsRecordPlugin] No media_key found in broadcastInfo"
      );
      return;
    }
    this.mediaKey = broadcastInfo.broadcast.media_key;
    const roomId = broadcastInfo.room_id || "unknown_room";
    if (!this.outputPath) {
      this.outputPath = `/tmp/record_${roomId}.ts`;
    }
    this.logger?.info(
      `[HlsRecordPlugin] init => ready to record. Output path="${this.outputPath}"`
    );
    this.space?.on("occupancyUpdate", (update) => {
      this.handleOccupancyUpdate(update).catch((err) => {
        this.logger?.error("[HlsRecordPlugin] handleOccupancyUpdate =>", err);
      });
    });
  }
  /**
   * If occupancy > 0 and we're not recording yet, attempt to fetch the HLS URL
   * from Twitter. If it's ready, spawn ffmpeg to record.
   */
  async handleOccupancyUpdate(update) {
    if (!this.space || !this.mediaKey) return;
    if (this.isRecording) return;
    if (update.occupancy <= 0) {
      this.logger?.debug("[HlsRecordPlugin] occupancy=0 => ignoring");
      return;
    }
    this.logger?.debug(
      `[HlsRecordPlugin] occupancy=${update.occupancy} => trying to fetch HLS URL...`
    );
    const scraper = this.space.scraper;
    if (!scraper) {
      this.logger?.warn("[HlsRecordPlugin] No scraper found on space");
      return;
    }
    try {
      const status = await scraper.getAudioSpaceStreamStatus(this.mediaKey);
      if (!status?.source?.location) {
        this.logger?.debug(
          "[HlsRecordPlugin] occupancy>0 but no HLS URL => wait next update"
        );
        return;
      }
      const hlsUrl = status.source.location;
      const isReady = await this.waitForHlsReady(hlsUrl, 1);
      if (!isReady) {
        this.logger?.debug(
          "[HlsRecordPlugin] HLS URL 404 => waiting next occupancy update..."
        );
        return;
      }
      await this.startRecording(hlsUrl);
    } catch (err) {
      this.logger?.error("[HlsRecordPlugin] handleOccupancyUpdate =>", err);
    }
  }
  /**
   * HEAD request to see if the HLS URL is returning 200 OK.
   * maxRetries=1 => only try once here; rely on occupancy re-calls otherwise.
   */
  async waitForHlsReady(hlsUrl, maxRetries) {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        const resp = await fetch(hlsUrl, { method: "HEAD" });
        if (resp.ok) {
          this.logger?.debug(
            `[HlsRecordPlugin] HLS is ready (attempt #${attempt + 1})`
          );
          return true;
        } else {
          this.logger?.debug(
            `[HlsRecordPlugin] HLS status=${resp.status}, retrying...`
          );
        }
      } catch (error) {
        this.logger?.debug(
          "[HlsRecordPlugin] HLS fetch error =>",
          error.message
        );
      }
      attempt++;
      await new Promise((r) => setTimeout(r, 2e3));
    }
    return false;
  }
  /**
   * Spawns ffmpeg to record the HLS stream at the given URL.
   */
  async startRecording(hlsUrl) {
    if (this.isRecording) {
      this.logger?.debug("[HlsRecordPlugin] Already recording, skipping...");
      return;
    }
    this.isRecording = true;
    if (!this.outputPath) {
      this.logger?.warn(
        "[HlsRecordPlugin] No output path set, using /tmp/space_record.ts"
      );
      this.outputPath = "/tmp/space_record.ts";
    }
    this.logger?.info("[HlsRecordPlugin] Starting HLS recording =>", hlsUrl);
    this.recordingProcess = child_process.spawn("ffmpeg", [
      "-y",
      "-i",
      hlsUrl,
      "-c",
      "copy",
      this.outputPath
    ]);
    this.recordingProcess.stderr.on("data", (chunk) => {
      const msg = chunk.toString();
      if (msg.toLowerCase().includes("error")) {
        this.logger?.error("[HlsRecordPlugin][ffmpeg error] =>", msg.trim());
      } else {
        this.logger?.debug("[HlsRecordPlugin][ffmpeg]", msg.trim());
      }
    });
    this.recordingProcess.on("close", (code) => {
      this.isRecording = false;
      this.logger?.info(
        "[HlsRecordPlugin] Recording process closed => code=",
        code
      );
    });
    this.recordingProcess.on("error", (err) => {
      this.logger?.error("[HlsRecordPlugin] Recording process failed =>", err);
    });
  }
  /**
   * Called when the plugin is cleaned up (e.g. space.stop()).
   * Kills ffmpeg if still running.
   */
  cleanup() {
    if (this.isRecording && this.recordingProcess) {
      this.logger?.info("[HlsRecordPlugin] Stopping HLS recording...");
      this.recordingProcess.kill();
      this.recordingProcess = void 0;
      this.isRecording = false;
    }
  }
}

exports.ChatClient = ChatClient;
exports.HlsRecordPlugin = HlsRecordPlugin;
exports.IdleMonitorPlugin = IdleMonitorPlugin;
exports.JanusAudioSink = JanusAudioSink;
exports.JanusAudioSource = JanusAudioSource;
exports.JanusClient = JanusClient;
exports.Logger = Logger;
exports.MonitorAudioPlugin = MonitorAudioPlugin;
exports.RecordToDiskPlugin = RecordToDiskPlugin;
exports.Scraper = Scraper;
exports.SearchMode = SearchMode;
exports.Space = Space;
exports.SpaceParticipant = SpaceParticipant;
exports.SttTtsPlugin = SttTtsPlugin;
//# sourceMappingURL=index.js.map
