import { Cookie } from 'tough-cookie';
import { PollV2, TTweetv2Expansion, TTweetv2TweetField, TTweetv2PollField, TTweetv2MediaField, TTweetv2UserField, TTweetv2PlaceField } from 'twitter-api-v2';
import { EventEmitter } from 'events';

type FetchParameters = [input: RequestInfo | URL, init?: RequestInit];
interface FetchTransformOptions {
    /**
     * Transforms the request options before a request is made. This executes after all of the default
     * parameters have been configured, and is stateless. It is safe to return new request options
     * objects.
     * @param args The request options.
     * @returns The transformed request options.
     */
    request: (...args: FetchParameters) => FetchParameters | Promise<FetchParameters>;
    /**
     * Transforms the response after a request completes. This executes immediately after the request
     * completes, and is stateless. It is safe to return a new response object.
     * @param response The response object.
     * @returns The transformed response object.
     */
    response: (response: Response) => Response | Promise<Response>;
}

/**
 * A parsed profile object.
 */
interface Profile {
    avatar?: string;
    banner?: string;
    biography?: string;
    birthday?: string;
    followersCount?: number;
    followingCount?: number;
    friendsCount?: number;
    mediaCount?: number;
    statusesCount?: number;
    isPrivate?: boolean;
    isVerified?: boolean;
    isBlueVerified?: boolean;
    joined?: Date;
    likesCount?: number;
    listedCount?: number;
    location: string;
    name?: string;
    pinnedTweetIds?: string[];
    tweetsCount?: number;
    url?: string;
    userId?: string;
    username?: string;
    website?: string;
    canDm?: boolean;
}

interface TimelineArticle {
    id: string;
    articleId: string;
    title: string;
    previewText: string;
    coverMediaUrl?: string;
    text: string;
}

interface Mention {
    id: string;
    username?: string;
    name?: string;
}
interface Photo {
    id: string;
    url: string;
    alt_text: string | undefined;
}
interface Video {
    id: string;
    preview: string;
    url?: string;
}
interface PlaceRaw {
    id?: string;
    place_type?: string;
    name?: string;
    full_name?: string;
    country_code?: string;
    country?: string;
    bounding_box?: {
        type?: string;
        coordinates?: number[][][];
    };
}
interface PollData {
    id?: string;
    end_datetime?: string;
    voting_status?: string;
    duration_minutes: number;
    options: PollOption[];
}
interface PollOption {
    position?: number;
    label: string;
    votes?: number;
}
/**
 * A parsed Tweet object.
 */
interface Tweet {
    bookmarkCount?: number;
    conversationId?: string;
    hashtags: string[];
    html?: string;
    id?: string;
    inReplyToStatus?: Tweet;
    inReplyToStatusId?: string;
    isQuoted?: boolean;
    isPin?: boolean;
    isReply?: boolean;
    isRetweet?: boolean;
    isSelfThread?: boolean;
    language?: string;
    likes?: number;
    name?: string;
    mentions: Mention[];
    permanentUrl?: string;
    photos: Photo[];
    place?: PlaceRaw;
    quotedStatus?: Tweet;
    quotedStatusId?: string;
    quotes?: number;
    replies?: number;
    retweets?: number;
    retweetedStatus?: Tweet;
    retweetedStatusId?: string;
    text?: string;
    thread: Tweet[];
    timeParsed?: Date;
    timestamp?: number;
    urls: string[];
    userId?: string;
    username?: string;
    videos: Video[];
    views?: number;
    sensitiveContent?: boolean;
    poll?: PollV2 | null;
}
interface Retweeter {
    rest_id: string;
    screen_name: string;
    name: string;
    description?: string;
}
type TweetQuery = Partial<Tweet> | ((tweet: Tweet) => boolean | Promise<boolean>);

/**
 * A paginated tweets API response. The `next` field can be used to fetch the next page of results,
 * and the `previous` can be used to fetch the previous results (or results created after the
 * initial request)
 */
interface QueryTweetsResponse {
    tweets: Tweet[];
    next?: string;
    previous?: string;
}
/**
 * A paginated profiles API response. The `next` field can be used to fetch the next page of results.
 */
interface QueryProfilesResponse {
    profiles: Profile[];
    next?: string;
    previous?: string;
}

/**
 * The categories that can be used in Twitter searches.
 */
declare enum SearchMode {
    Top = 0,
    Latest = 1,
    Photos = 2,
    Videos = 3,
    Users = 4
}

interface DirectMessage {
    id: string;
    text: string;
    senderId: string;
    recipientId: string;
    createdAt: string;
    mediaUrls?: string[];
    senderScreenName?: string;
    recipientScreenName?: string;
}
interface DirectMessageConversation {
    conversationId: string;
    messages: DirectMessage[];
    participants: {
        id: string;
        screenName: string;
    }[];
}
interface DirectMessagesResponse {
    conversations: DirectMessageConversation[];
    users: TwitterUser[];
    cursor?: string;
    lastSeenEventId?: string;
    trustedLastSeenEventId?: string;
    untrustedLastSeenEventId?: string;
    inboxTimelines?: {
        trusted?: {
            status: string;
            minEntryId?: string;
        };
        untrusted?: {
            status: string;
            minEntryId?: string;
        };
    };
    userId: string;
}
interface TwitterUser {
    id: string;
    screenName: string;
    name: string;
    profileImageUrl: string;
    description?: string;
    verified?: boolean;
    protected?: boolean;
    followersCount?: number;
    friendsCount?: number;
}
interface SendDirectMessageResponse {
    entries: {
        message: {
            id: string;
            time: string;
            affects_sort: boolean;
            conversation_id: string;
            message_data: {
                id: string;
                time: string;
                recipient_id: string;
                sender_id: string;
                text: string;
            };
        };
    }[];
    users: Record<string, TwitterUser>;
}

/**
 * Represents a Community that can host Spaces.
 */
interface Community {
    id: string;
    name: string;
    rest_id: string;
}
/**
 * Represents the response structure for the CommunitySelectQuery.
 */
interface CommunitySelectQueryResponse {
    data: {
        space_hostable_communities: Community[];
    };
    errors?: any[];
}
/**
 * Represents a Subtopic within a Category.
 */
interface Subtopic {
    icon_url: string;
    name: string;
    topic_id: string;
}
/**
 * Represents a Category containing multiple Subtopics.
 */
interface Category {
    icon: string;
    name: string;
    semantic_core_entity_id: string;
    subtopics: Subtopic[];
}
/**
 * Represents the data structure for BrowseSpaceTopics.
 */
interface BrowseSpaceTopics {
    categories: Category[];
}
/**
 * Represents the response structure for the BrowseSpaceTopics query.
 */
interface BrowseSpaceTopicsResponse {
    data: {
        browse_space_topics: BrowseSpaceTopics;
    };
    errors?: any[];
}
/**
 * Represents the result details of a Creator.
 */
interface CreatorResult {
    __typename: string;
    id: string;
    rest_id: string;
    affiliates_highlighted_label: Record<string, any>;
    has_graduated_access: boolean;
    is_blue_verified: boolean;
    profile_image_shape: string;
    legacy: {
        following: boolean;
        can_dm: boolean;
        can_media_tag: boolean;
        created_at: string;
        default_profile: boolean;
        default_profile_image: boolean;
        description: string;
        entities: {
            description: {
                urls: any[];
            };
        };
        fast_followers_count: number;
        favourites_count: number;
        followers_count: number;
        friends_count: number;
        has_custom_timelines: boolean;
        is_translator: boolean;
        listed_count: number;
        location: string;
        media_count: number;
        name: string;
        needs_phone_verification: boolean;
        normal_followers_count: number;
        pinned_tweet_ids_str: string[];
        possibly_sensitive: boolean;
        profile_image_url_https: string;
        profile_interstitial_type: string;
        screen_name: string;
        statuses_count: number;
        translator_type: string;
        verified: boolean;
        want_retweets: boolean;
        withheld_in_countries: string[];
    };
    tipjar_settings: Record<string, any>;
}
/**
 * Represents user results within an Admin.
 */
interface UserResults {
    rest_id: string;
    result: {
        __typename: string;
        identity_profile_labels_highlighted_label: Record<string, any>;
        is_blue_verified: boolean;
        legacy: Record<string, any>;
    };
}
/**
 * Represents an Admin participant in an Audio Space.
 */
interface Admin {
    periscope_user_id: string;
    start: number;
    twitter_screen_name: string;
    display_name: string;
    avatar_url: string;
    is_verified: boolean;
    is_muted_by_admin: boolean;
    is_muted_by_guest: boolean;
    user_results: UserResults;
}
/**
 * Represents Participants in an Audio Space.
 */
interface Participants {
    total: number;
    admins: Admin[];
    speakers: any[];
    listeners: any[];
}
/**
 * Represents Metadata of an Audio Space.
 */
interface Metadata {
    rest_id: string;
    state: string;
    media_key: string;
    created_at: number;
    started_at: number;
    ended_at: string;
    updated_at: number;
    content_type: string;
    creator_results: {
        result: CreatorResult;
    };
    conversation_controls: number;
    disallow_join: boolean;
    is_employee_only: boolean;
    is_locked: boolean;
    is_muted: boolean;
    is_space_available_for_clipping: boolean;
    is_space_available_for_replay: boolean;
    narrow_cast_space_type: number;
    no_incognito: boolean;
    total_replay_watched: number;
    total_live_listeners: number;
    tweet_results: Record<string, any>;
    max_guest_sessions: number;
    max_admin_capacity: number;
}
/**
 * Represents Sharings within an Audio Space.
 */
interface Sharings {
    items: any[];
    slice_info: Record<string, any>;
}
/**
 * Represents an Audio Space.
 */
interface AudioSpace {
    metadata: Metadata;
    is_subscribed: boolean;
    participants: Participants;
    sharings: Sharings;
}
/**
 * Represents the response structure for the AudioSpaceById query.
 */
interface AudioSpaceByIdResponse {
    data: {
        audioSpace: AudioSpace;
    };
    errors?: any[];
}
/**
 * Represents the variables required for the AudioSpaceById query.
 */
interface AudioSpaceByIdVariables {
    id: string;
    isMetatagsQuery: boolean;
    withReplays: boolean;
    withListeners: boolean;
}
interface LiveVideoSource {
    location: string;
    noRedirectPlaybackUrl: string;
    status: string;
    streamType: string;
}
interface LiveVideoStreamStatus {
    source: LiveVideoSource;
    sessionId: string;
    chatToken: string;
    lifecycleToken: string;
    shareUrl: string;
    chatPermissionType: string;
}
interface AuthenticatePeriscopeResponse {
    data: {
        authenticate_periscope: string;
    };
    errors?: any[];
}
interface LoginTwitterTokenResponse {
    cookie: string;
    user: {
        class_name: string;
        id: string;
        created_at: string;
        is_beta_user: boolean;
        is_employee: boolean;
        is_twitter_verified: boolean;
        verified_type: number;
        is_bluebird_user: boolean;
        twitter_screen_name: string;
        username: string;
        display_name: string;
        description: string;
        profile_image_urls: {
            url: string;
            ssl_url: string;
            width: number;
            height: number;
        }[];
        twitter_id: string;
        initials: string;
        n_followers: number;
        n_following: number;
    };
    type: string;
}

interface GrokMessage {
    role: 'user' | 'assistant';
    content: string;
}
interface GrokChatOptions {
    messages: GrokMessage[];
    conversationId?: string;
    returnSearchResults?: boolean;
    returnCitations?: boolean;
}
interface GrokRateLimit {
    isRateLimited: boolean;
    message: string;
    upsellInfo?: {
        usageLimit: string;
        quotaDuration: string;
        title: string;
        message: string;
    };
}
interface GrokChatResponse {
    conversationId: string;
    message: string;
    messages: GrokMessage[];
    webResults?: any[];
    metadata?: any;
    rateLimit?: GrokRateLimit;
}

interface ScraperOptions {
    /**
     * An alternative fetch function to use instead of the default fetch function. This may be useful
     * in nonstandard runtime environments, such as edge workers.
     */
    fetch: typeof fetch;
    /**
     * Additional options that control how requests and responses are processed. This can be used to
     * proxy requests through other hosts, for example.
     */
    transform: Partial<FetchTransformOptions>;
}
/**
 * An interface to Twitter's undocumented API.
 * - Reusing Scraper objects is recommended to minimize the time spent authenticating unnecessarily.
 */
declare class Scraper {
    private readonly options?;
    private auth;
    private authTrends;
    private token;
    /**
     * Creates a new Scraper object.
     * - Scrapers maintain their own guest tokens for Twitter's internal API.
     * - Reusing Scraper objects is recommended to minimize the time spent authenticating unnecessarily.
     */
    constructor(options?: Partial<ScraperOptions> | undefined);
    /**
     * Fetches a Twitter profile.
     * @param username The Twitter username of the profile to fetch, without an `@` at the beginning.
     * @returns The requested {@link Profile}.
     */
    getProfile(username: string): Promise<Profile>;
    /**
     * Fetches the user ID corresponding to the provided screen name.
     * @param screenName The Twitter screen name of the profile to fetch.
     * @returns The ID of the corresponding account.
     */
    getUserIdByScreenName(screenName: string): Promise<string>;
    /**
     *
     * @param userId The user ID of the profile to fetch.
     * @returns The screen name of the corresponding account.
     */
    getScreenNameByUserId(userId: string): Promise<string>;
    /**
     * Fetches tweets from Twitter.
     * @param query The search query. Any Twitter-compatible query format can be used.
     * @param maxTweets The maximum number of tweets to return.
     * @param includeReplies Whether or not replies should be included in the response.
     * @param searchMode The category filter to apply to the search. Defaults to `Top`.
     * @returns An {@link AsyncGenerator} of tweets matching the provided filters.
     */
    searchTweets(query: string, maxTweets: number, searchMode?: SearchMode): AsyncGenerator<Tweet, void>;
    /**
     * Fetches profiles from Twitter.
     * @param query The search query. Any Twitter-compatible query format can be used.
     * @param maxProfiles The maximum number of profiles to return.
     * @returns An {@link AsyncGenerator} of tweets matching the provided filter(s).
     */
    searchProfiles(query: string, maxProfiles: number): AsyncGenerator<Profile, void>;
    /**
     * Fetches tweets from Twitter.
     * @param query The search query. Any Twitter-compatible query format can be used.
     * @param maxTweets The maximum number of tweets to return.
     * @param includeReplies Whether or not replies should be included in the response.
     * @param searchMode The category filter to apply to the search. Defaults to `Top`.
     * @param cursor The search cursor, which can be passed into further requests for more results.
     * @returns A page of results, containing a cursor that can be used in further requests.
     */
    fetchSearchTweets(query: string, maxTweets: number, searchMode: SearchMode, cursor?: string): Promise<QueryTweetsResponse>;
    /**
     * Fetches profiles from Twitter.
     * @param query The search query. Any Twitter-compatible query format can be used.
     * @param maxProfiles The maximum number of profiles to return.
     * @param cursor The search cursor, which can be passed into further requests for more results.
     * @returns A page of results, containing a cursor that can be used in further requests.
     */
    fetchSearchProfiles(query: string, maxProfiles: number, cursor?: string): Promise<QueryProfilesResponse>;
    /**
     * Fetches list tweets from Twitter.
     * @param listId The list id
     * @param maxTweets The maximum number of tweets to return.
     * @param cursor The search cursor, which can be passed into further requests for more results.
     * @returns A page of results, containing a cursor that can be used in further requests.
     */
    fetchListTweets(listId: string, maxTweets: number, cursor?: string): Promise<QueryTweetsResponse>;
    /**
     * Fetch the profiles a user is following
     * @param userId The user whose following should be returned
     * @param maxProfiles The maximum number of profiles to return.
     * @returns An {@link AsyncGenerator} of following profiles for the provided user.
     */
    getFollowing(userId: string, maxProfiles: number): AsyncGenerator<Profile, void>;
    /**
     * Fetch the profiles that follow a user
     * @param userId The user whose followers should be returned
     * @param maxProfiles The maximum number of profiles to return.
     * @returns An {@link AsyncGenerator} of profiles following the provided user.
     */
    getFollowers(userId: string, maxProfiles: number): AsyncGenerator<Profile, void>;
    /**
     * Fetches following profiles from Twitter.
     * @param userId The user whose following should be returned
     * @param maxProfiles The maximum number of profiles to return.
     * @param cursor The search cursor, which can be passed into further requests for more results.
     * @returns A page of results, containing a cursor that can be used in further requests.
     */
    fetchProfileFollowing(userId: string, maxProfiles: number, cursor?: string): Promise<QueryProfilesResponse>;
    /**
     * Fetches profile followers from Twitter.
     * @param userId The user whose following should be returned
     * @param maxProfiles The maximum number of profiles to return.
     * @param cursor The search cursor, which can be passed into further requests for more results.
     * @returns A page of results, containing a cursor that can be used in further requests.
     */
    fetchProfileFollowers(userId: string, maxProfiles: number, cursor?: string): Promise<QueryProfilesResponse>;
    /**
     * Fetches the home timeline for the current user. (for you feed)
     * @param count The number of tweets to fetch.
     * @param seenTweetIds An array of tweet IDs that have already been seen.
     * @returns A promise that resolves to the home timeline response.
     */
    fetchHomeTimeline(count: number, seenTweetIds: string[]): Promise<any[]>;
    /**
     * Fetches the home timeline for the current user. (following feed)
     * @param count The number of tweets to fetch.
     * @param seenTweetIds An array of tweet IDs that have already been seen.
     * @returns A promise that resolves to the home timeline response.
     */
    fetchFollowingTimeline(count: number, seenTweetIds: string[]): Promise<any[]>;
    getUserTweets(userId: string, maxTweets?: number, cursor?: string): Promise<{
        tweets: Tweet[];
        next?: string;
    }>;
    getUserTweetsIterator(userId: string, maxTweets?: number): AsyncGenerator<Tweet, void>;
    /**
     * Fetches the current trends from Twitter.
     * @returns The current list of trends.
     */
    getTrends(): Promise<string[]>;
    /**
     * Fetches tweets from a Twitter user.
     * @param user The user whose tweets should be returned.
     * @param maxTweets The maximum number of tweets to return. Defaults to `200`.
     * @returns An {@link AsyncGenerator} of tweets from the provided user.
     */
    getTweets(user: string, maxTweets?: number): AsyncGenerator<Tweet>;
    /**
     * Fetches tweets from a Twitter user using their ID.
     * @param userId The user whose tweets should be returned.
     * @param maxTweets The maximum number of tweets to return. Defaults to `200`.
     * @returns An {@link AsyncGenerator} of tweets from the provided user.
     */
    getTweetsByUserId(userId: string, maxTweets?: number): AsyncGenerator<Tweet, void>;
    /**
     * Send a tweet
     * @param text The text of the tweet
     * @param tweetId The id of the tweet to reply to
     * @param mediaData Optional media data
     * @returns
     */
    sendTweet(text: string, replyToTweetId?: string, mediaData?: {
        data: Buffer;
        mediaType: string;
    }[], hideLinkPreview?: boolean): Promise<Response>;
    sendNoteTweet(text: string, replyToTweetId?: string, mediaData?: {
        data: Buffer;
        mediaType: string;
    }[]): Promise<any>;
    /**
     * Send a long tweet (Note Tweet)
     * @param text The text of the tweet
     * @param tweetId The id of the tweet to reply to
     * @param mediaData Optional media data
     * @returns
     */
    sendLongTweet(text: string, replyToTweetId?: string, mediaData?: {
        data: Buffer;
        mediaType: string;
    }[]): Promise<Response>;
    /**
     * Send a tweet
     * @param text The text of the tweet
     * @param tweetId The id of the tweet to reply to
     * @param options The options for the tweet
     * @returns
     */
    sendTweetV2(text: string, replyToTweetId?: string, options?: {
        poll?: PollData;
        quoted_tweet_id?: string;
    }): Promise<Tweet | null>;
    /**
     * Fetches tweets and replies from a Twitter user.
     * @param user The user whose tweets should be returned.
     * @param maxTweets The maximum number of tweets to return. Defaults to `200`.
     * @returns An {@link AsyncGenerator} of tweets from the provided user.
     */
    getTweetsAndReplies(user: string, maxTweets?: number): AsyncGenerator<Tweet>;
    /**
     * Fetches tweets and replies from a Twitter user using their ID.
     * @param userId The user whose tweets should be returned.
     * @param maxTweets The maximum number of tweets to return. Defaults to `200`.
     * @returns An {@link AsyncGenerator} of tweets from the provided user.
     */
    getTweetsAndRepliesByUserId(userId: string, maxTweets?: number): AsyncGenerator<Tweet, void>;
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
    getTweetWhere(tweets: AsyncIterable<Tweet>, query: TweetQuery): Promise<Tweet | null>;
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
    getTweetsWhere(tweets: AsyncIterable<Tweet>, query: TweetQuery): Promise<Tweet[]>;
    /**
     * Fetches the most recent tweet from a Twitter user.
     * @param user The user whose latest tweet should be returned.
     * @param includeRetweets Whether or not to include retweets. Defaults to `false`.
     * @returns The {@link Tweet} object or `null`/`undefined` if it couldn't be fetched.
     */
    getLatestTweet(user: string, includeRetweets?: boolean, max?: number): Promise<Tweet | null | void>;
    /**
     * Fetches a single tweet.
     * @param id The ID of the tweet to fetch.
     * @returns The {@link Tweet} object, or `null` if it couldn't be fetched.
     */
    getTweet(id: string): Promise<Tweet | null>;
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
    getTweetV2(id: string, options?: {
        expansions?: TTweetv2Expansion[];
        tweetFields?: TTweetv2TweetField[];
        pollFields?: TTweetv2PollField[];
        mediaFields?: TTweetv2MediaField[];
        userFields?: TTweetv2UserField[];
        placeFields?: TTweetv2PlaceField[];
    }): Promise<Tweet | null>;
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
    getTweetsV2(ids: string[], options?: {
        expansions?: TTweetv2Expansion[];
        tweetFields?: TTweetv2TweetField[];
        pollFields?: TTweetv2PollField[];
        mediaFields?: TTweetv2MediaField[];
        userFields?: TTweetv2UserField[];
        placeFields?: TTweetv2PlaceField[];
    }): Promise<Tweet[]>;
    /**
     * Returns if the scraper has a guest token. The token may not be valid.
     * @returns `true` if the scraper has a guest token; otherwise `false`.
     */
    hasGuestToken(): boolean;
    /**
     * Returns if the scraper is logged in as a real user.
     * @returns `true` if the scraper is logged in with a real user account; otherwise `false`.
     */
    isLoggedIn(): Promise<boolean>;
    /**
     * Returns the currently logged in user
     * @returns The currently logged in user
     */
    me(): Promise<Profile | undefined>;
    /**
     * Login to Twitter as a real Twitter account. This enables running
     * searches.
     * @param username The username of the Twitter account to login with.
     * @param password The password of the Twitter account to login with.
     * @param email The email to log in with, if you have email confirmation enabled.
     * @param twoFactorSecret The secret to generate two factor authentication tokens with, if you have two factor authentication enabled.
     */
    login(username: string, password: string, email?: string, twoFactorSecret?: string, appKey?: string, appSecret?: string, accessToken?: string, accessSecret?: string): Promise<void>;
    /**
     * Log out of Twitter.
     */
    logout(): Promise<void>;
    /**
     * Retrieves all cookies for the current session.
     * @returns All cookies for the current session.
     */
    getCookies(): Promise<Cookie[]>;
    /**
     * Set cookies for the current session.
     * @param cookies The cookies to set for the current session.
     */
    setCookies(cookies: (string | Cookie)[]): Promise<void>;
    /**
     * Clear all cookies for the current session.
     */
    clearCookies(): Promise<void>;
    /**
     * Sets the optional cookie to be used in requests.
     * @param _cookie The cookie to be used in requests.
     * @deprecated This function no longer represents any part of Twitter's auth flow.
     * @returns This scraper instance.
     */
    withCookie(_cookie: string): Scraper;
    /**
     * Sets the optional CSRF token to be used in requests.
     * @param _token The CSRF token to be used in requests.
     * @deprecated This function no longer represents any part of Twitter's auth flow.
     * @returns This scraper instance.
     */
    withXCsrfToken(_token: string): Scraper;
    /**
     * Sends a quote tweet.
     * @param text The text of the tweet.
     * @param quotedTweetId The ID of the tweet to quote.
     * @param options Optional parameters, such as media data.
     * @returns The response from the Twitter API.
     */
    sendQuoteTweet(text: string, quotedTweetId: string, options?: {
        mediaData: {
            data: Buffer;
            mediaType: string;
        }[];
    }): Promise<Response>;
    /**
     * Likes a tweet with the given tweet ID.
     * @param tweetId The ID of the tweet to like.
     * @returns A promise that resolves when the tweet is liked.
     */
    likeTweet(tweetId: string): Promise<void>;
    /**
     * Retweets a tweet with the given tweet ID.
     * @param tweetId The ID of the tweet to retweet.
     * @returns A promise that resolves when the tweet is retweeted.
     */
    retweet(tweetId: string): Promise<void>;
    /**
     * Follows a user with the given user ID.
     * @param userId The user ID of the user to follow.
     * @returns A promise that resolves when the user is followed.
     */
    followUser(userName: string): Promise<void>;
    /**
     * Fetches direct message conversations
     * @param count Number of conversations to fetch (default: 50)
     * @param cursor Pagination cursor for fetching more conversations
     * @returns Array of DM conversations and other details
     */
    getDirectMessageConversations(userId: string, cursor?: string): Promise<DirectMessagesResponse>;
    /**
     * Sends a direct message to a user.
     * @param conversationId The ID of the conversation to send the message to.
     * @param text The text of the message to send.
     * @returns The response from the Twitter API.
     */
    sendDirectMessage(conversationId: string, text: string): Promise<SendDirectMessageResponse>;
    private getAuthOptions;
    private handleResponse;
    /**
     * Retrieves the details of an Audio Space by its ID.
     * @param id The ID of the Audio Space.
     * @returns The details of the Audio Space.
     */
    getAudioSpaceById(id: string): Promise<AudioSpace>;
    /**
     * Retrieves available space topics.
     * @returns An array of space topics.
     */
    browseSpaceTopics(): Promise<Subtopic[]>;
    /**
     * Retrieves available communities.
     * @returns An array of communities.
     */
    communitySelectQuery(): Promise<Community[]>;
    /**
     * Retrieves the status of an Audio Space stream by its media key.
     * @param mediaKey The media key of the Audio Space.
     * @returns The status of the Audio Space stream.
     */
    getAudioSpaceStreamStatus(mediaKey: string): Promise<LiveVideoStreamStatus>;
    /**
     * Retrieves the status of an Audio Space by its ID.
     * This method internally fetches the Audio Space to obtain the media key,
     * then retrieves the stream status using the media key.
     * @param audioSpaceId The ID of the Audio Space.
     * @returns The status of the Audio Space stream.
     */
    getAudioSpaceStatus(audioSpaceId: string): Promise<LiveVideoStreamStatus>;
    /**
     * Authenticates Periscope to obtain a token.
     * @returns The Periscope authentication token.
     */
    authenticatePeriscope(): Promise<string>;
    /**
     * Logs in to Twitter via Proxsee using the Periscope JWT.
     * @param jwt The JWT obtained from AuthenticatePeriscope.
     * @returns The response containing the cookie and user information.
     */
    loginTwitterToken(jwt: string): Promise<LoginTwitterTokenResponse>;
    /**
     * Orchestrates the flow: get token -> login -> return Periscope cookie
     */
    getPeriscopeCookie(): Promise<string>;
    /**
     * Fetches a article (long form tweet) by its ID.
     * @param id The ID of the article to fetch. In the format of (http://x.com/i/article/id)
     * @returns The {@link TimelineArticle} object, or `null` if it couldn't be fetched.
     */
    getArticle(id: string): Promise<TimelineArticle | null>;
    /**
     * Creates a new conversation with Grok.
     * @returns A promise that resolves to the conversation ID string.
     */
    createGrokConversation(): Promise<string>;
    /**
     * Interact with Grok in a chat-like manner.
     * @param options The options for the Grok chat interaction.
     * @param {GrokMessage[]} options.messages - Array of messages in the conversation.
     * @param {string} [options.conversationId] - Optional ID of an existing conversation.
     * @param {boolean} [options.returnSearchResults] - Whether to return search results.
     * @param {boolean} [options.returnCitations] - Whether to return citations.
     * @returns A promise that resolves to the Grok chat response.
     */
    grokChat(options: GrokChatOptions): Promise<GrokChatResponse>;
    /**
     * Retrieves all users who retweeted the given tweet.
     * @param tweetId The ID of the tweet.
     * @returns An array of users (retweeters).
     */
    getRetweetersOfTweet(tweetId: string): Promise<Retweeter[]>;
    /**
     * Fetches all tweets quoting a given tweet ID by chaining requests
     * until no more pages are available.
     * @param quotedTweetId The tweet ID to find quotes of.
     * @param maxTweetsPerPage Max tweets per page (default 20).
     * @returns An array of all Tweet objects referencing the given tweet.
     */
    getAllQuotedTweets(quotedTweetId: string, maxTweetsPerPage?: number): Promise<Tweet[]>;
}

interface SpaceParticipantConfig {
    spaceId: string;
    debug?: boolean;
}
/**
 * Manages joining an existing Space in listener mode,
 * and optionally becoming a speaker via WebRTC (Janus).
 */
declare class SpaceParticipant extends EventEmitter {
    private readonly scraper;
    private readonly spaceId;
    private readonly debug;
    private readonly logger;
    private cookie?;
    private authToken?;
    private chatJwtToken?;
    private chatToken?;
    private chatClient?;
    private lifecycleToken?;
    private watchSession?;
    private hlsUrl?;
    private sessionUUID?;
    private janusJwt?;
    private webrtcGwUrl?;
    private janusClient?;
    private plugins;
    constructor(scraper: Scraper, config: SpaceParticipantConfig);
    /**
     * Adds a plugin and calls its onAttach immediately.
     * init() or onJanusReady() will be invoked later at the appropriate time.
     */
    use(plugin: Plugin, config?: Record<string, any>): this;
    /**
     * Joins the Space as a listener: obtains HLS, chat token, etc.
     */
    joinAsListener(): Promise<void>;
    /**
     * Returns the HLS URL if you want to consume the stream as a listener.
     */
    getHlsUrl(): string | undefined;
    /**
     * Submits a speaker request using /audiospace/request/submit.
     * Returns the sessionUUID used to track approval.
     */
    requestSpeaker(): Promise<{
        sessionUUID: string;
    }>;
    /**
     * Cancels a previously submitted speaker request using /audiospace/request/cancel.
     * This requires a valid sessionUUID from requestSpeaker() first.
     */
    cancelSpeakerRequest(): Promise<void>;
    /**
     * Once the host approves our speaker request, we perform Janus negotiation
     * to become a speaker.
     */
    becomeSpeaker(): Promise<void>;
    /**
     * Leaves the Space gracefully:
     * - Stop Janus if we were a speaker
     * - Stop watching as a viewer
     * - Disconnect chat
     */
    leaveSpace(): Promise<void>;
    /**
     * Pushes PCM audio frames if we're speaker; otherwise logs a warning.
     */
    pushAudio(samples: Int16Array, sampleRate: number): void;
    /**
     * Internal handler for incoming PCM frames from Janus, forwarded to plugin.onAudioData if present.
     */
    private handleAudioData;
    /**
     * Sets up chat events: "occupancyUpdate", "newSpeakerAccepted", etc.
     */
    private setupChatEvents;
    /**
     * Mute self if we are speaker: calls /audiospace/muteSpeaker with our sessionUUID.
     */
    muteSelf(): Promise<void>;
    /**
     * Unmute self if we are speaker: calls /audiospace/unmuteSpeaker with our sessionUUID.
     */
    unmuteSelf(): Promise<void>;
}

/**
 * Basic PCM audio frame properties.
 */
interface AudioData {
    /**
     * Bits per sample (e.g., 16).
     */
    bitsPerSample: number;
    /**
     * The sample rate in Hz (e.g., 48000 for 48kHz).
     */
    sampleRate: number;
    /**
     * Number of channels (e.g., 1 for mono, 2 for stereo).
     */
    channelCount: number;
    /**
     * Number of frames (samples per channel).
     */
    numberOfFrames: number;
    /**
     * The raw PCM data for all channels (interleaved if stereo).
     */
    samples: Int16Array;
}
/**
 * PCM audio data with an associated user ID, indicating which speaker produced it.
 */
interface AudioDataWithUser extends AudioData {
    /**
     * The ID of the speaker or user who produced this audio frame.
     */
    userId: string;
}
/**
 * Information about a speaker request event in a Space.
 */
interface SpeakerRequest {
    userId: string;
    username: string;
    displayName: string;
    sessionUUID: string;
}
/**
 * Occupancy update describing the number of participants in a Space.
 */
interface OccupancyUpdate {
    occupancy: number;
    totalParticipants: number;
}
/**
 * Represents an emoji reaction event by a user in the chat.
 */
interface GuestReaction {
    displayName: string;
    emoji: string;
}
/**
 * Response structure after creating a broadcast on Periscope/Twitter.
 */
interface BroadcastCreated {
    room_id: string;
    credential: string;
    stream_name: string;
    webrtc_gw_url: string;
    broadcast: {
        user_id: string;
        twitter_id: string;
        media_key: string;
    };
    access_token: string;
    endpoint: string;
    share_url: string;
    stream_url: string;
}
/**
 * Describes TURN server credentials and URIs.
 */
interface TurnServersInfo {
    ttl: string;
    username: string;
    password: string;
    uris: string[];
}
/**
 * Defines a plugin interface for both Space (broadcast host) and SpaceParticipant (listener/speaker).
 *
 * Lifecycle hooks:
 *  - onAttach(...) is called immediately after .use(plugin).
 *  - init(...) is called after the space or participant has joined in basic mode (listener + chat).
 *  - onJanusReady(...) is called if/when a JanusClient is created (i.e., speaker mode).
 *  - onAudioData(...) is called upon receiving raw PCM frames from a speaker.
 *  - cleanup(...) is called when the space/participant stops or the plugin is removed.
 */
interface Plugin {
    /**
     * Called immediately when the plugin is added via .use(plugin).
     * Usually used for initial references or minimal setup.
     */
    onAttach?(params: {
        space: Space | SpaceParticipant;
        pluginConfig?: Record<string, any>;
    }): void;
    /**
     * Called once the space/participant has fully initialized basic features (chat, HLS, etc.).
     * This is the ideal place to finalize setup for plugins that do not require Janus/speaker mode.
     */
    init?(params: {
        space: Space | SpaceParticipant;
        pluginConfig?: Record<string, any>;
    }): void;
    /**
     * Called if/when a JanusClient becomes available (e.g., user becomes a speaker).
     * Plugins that need direct Janus interactions can implement logic here.
     */
    onJanusReady?(janusClient: any): void;
    /**
     * Called whenever raw PCM audio frames arrive from a speaker.
     * Useful for speech-to-text, analytics, or logging.
     */
    onAudioData?(data: AudioDataWithUser): void;
    /**
     * Cleanup lifecycle hook, invoked when the plugin is removed or the space/participant stops.
     * Allows releasing resources, stopping timers, or closing file handles.
     */
    cleanup?(): void;
}
/**
 * Internal registration structure for a plugin, used to store the plugin instance + config.
 */
interface PluginRegistration {
    plugin: Plugin;
    config?: Record<string, any>;
}
/**
 * Stores information about a speaker in a Space (host perspective).
 */
interface SpeakerInfo {
    userId: string;
    sessionUUID: string;
    janusParticipantId?: number;
}

interface SpaceConfig {
    mode: 'BROADCAST' | 'LISTEN' | 'INTERACTIVE';
    title?: string;
    description?: string;
    languages?: string[];
    debug?: boolean;
    record: boolean;
}
/**
 * Manages the creation of a new Space (broadcast host):
 * 1) Creates the broadcast on Periscope
 * 2) Sets up Janus WebRTC for audio
 * 3) Optionally creates a ChatClient for interactive mode
 * 4) Allows managing (approve/remove) speakers, pushing audio, etc.
 */
declare class Space extends EventEmitter {
    private readonly scraper;
    private readonly debug;
    private readonly logger;
    private janusClient?;
    private chatClient?;
    private authToken?;
    private broadcastInfo?;
    private isInitialized;
    private plugins;
    private speakers;
    constructor(scraper: Scraper, options?: {
        debug?: boolean;
    });
    /**
     * Registers a plugin and calls its onAttach(...).
     * init(...) will be invoked once initialization is complete.
     */
    use(plugin: Plugin, config?: Record<string, any>): this;
    /**
     * Main entry point to create and initialize the Space broadcast.
     */
    initialize(config: SpaceConfig): Promise<BroadcastCreated>;
    /**
     * Send an emoji reaction via chat, if interactive.
     */
    reactWithEmoji(emoji: string): void;
    /**
     * Internal method to wire up chat events if interactive.
     */
    private setupChatEvents;
    /**
     * Approves a speaker request on Twitter side, then calls Janus to subscribe their audio.
     */
    approveSpeaker(userId: string, sessionUUID: string): Promise<void>;
    /**
     * Approve request => calls /api/v1/audiospace/request/approve
     */
    private callApproveEndpoint;
    /**
     * Removes a speaker from the Twitter side, then unsubscribes in Janus if needed.
     */
    removeSpeaker(userId: string): Promise<void>;
    /**
     * Twitter's /api/v1/audiospace/stream/eject call
     */
    private callRemoveEndpoint;
    /**
     * Push PCM audio frames if you're the host. Usually you'd do this if you're capturing
     * microphone input from the host side.
     */
    pushAudio(samples: Int16Array, sampleRate: number): void;
    /**
     * Handler for PCM from other speakers, forwarded to plugin.onAudioData
     */
    private handleAudioData;
    /**
     * Gracefully shut down this Space: destroy the Janus room, end the broadcast, etc.
     */
    finalizeSpace(): Promise<void>;
    /**
     * Calls /api/v1/audiospace/admin/endAudiospace on Twitter side.
     */
    private endAudiospace;
    /**
     * Retrieves an array of known speakers in this Space (by userId and sessionUUID).
     */
    getSpeakers(): SpeakerInfo[];
    /**
     * Mute the host (yourself). For the host, session_uuid = '' (empty).
     */
    muteHost(): Promise<void>;
    /**
     * Unmute the host (yourself).
     */
    unmuteHost(): Promise<void>;
    /**
     * Mute a specific speaker. We'll retrieve sessionUUID from our local map.
     */
    muteSpeaker(userId: string): Promise<void>;
    /**
     * Unmute a specific speaker. We'll retrieve sessionUUID from local map.
     */
    unmuteSpeaker(userId: string): Promise<void>;
    /**
     * Stop the broadcast entirely, performing finalizeSpace() plus plugin cleanup.
     */
    stop(): Promise<void>;
}

declare class Logger {
    private readonly debugEnabled;
    constructor(debugEnabled: boolean);
    info(msg: string, ...args: any[]): void;
    debug(msg: string, ...args: any[]): void;
    warn(msg: string, ...args: any[]): void;
    error(msg: string, ...args: any[]): void;
    isDebugEnabled(): boolean;
}

interface JanusConfig {
    /**
     * The base URL for the Janus gateway (e.g. "https://gw-prod-hydra-eu-west-3.pscp.tv/s=prod:XX/v1/gateway")
     */
    webrtcUrl: string;
    /**
     * The unique room ID (e.g., the broadcast or space ID)
     */
    roomId: string;
    /**
     * The token/credential used to authorize requests to Janus (often a signed JWT).
     */
    credential: string;
    /**
     * The user identifier (host or speaker). Used as 'display' in the Janus plugin.
     */
    userId: string;
    /**
     * The name of the stream (often the same as roomId for convenience).
     */
    streamName: string;
    /**
     * ICE / TURN server information returned by Twitter's /turnServers endpoint.
     */
    turnServers: TurnServersInfo;
    /**
     * Logger instance for consistent debug/info/error logs.
     */
    logger: Logger;
}
/**
 * Manages the Janus session for a Twitter AudioSpace:
 *  - Creates a Janus session and plugin handle
 *  - Joins the Janus videoroom as publisher/subscriber
 *  - Subscribes to other speakers
 *  - Sends local PCM frames as Opus
 *  - Polls for Janus events
 *
 * It can be used by both the host (who creates a room) or a guest speaker (who joins an existing room).
 */
declare class JanusClient extends EventEmitter {
    private readonly config;
    private logger;
    private sessionId?;
    private handleId?;
    private publisherId?;
    private pc?;
    private localAudioSource?;
    private pollActive;
    private eventWaiters;
    private subscribers;
    constructor(config: JanusConfig);
    /**
     * Initializes this JanusClient for the host scenario:
     *  1) createSession()
     *  2) attachPlugin()
     *  3) createRoom()
     *  4) joinRoom()
     *  5) configure local PeerConnection (send audio, etc.)
     */
    initialize(): Promise<void>;
    /**
     * Initializes this JanusClient for a guest speaker scenario:
     *  1) createSession()
     *  2) attachPlugin()
     *  3) join existing room as publisher (no createRoom call)
     *  4) configure local PeerConnection
     *  5) subscribe to any existing publishers
     */
    initializeGuestSpeaker(sessionUUID: string): Promise<void>;
    /**
     * Subscribes to a speaker's audio feed by userId and/or feedId.
     * If feedId=0, we wait for a "publishers" event to discover feedId.
     */
    subscribeSpeaker(userId: string, feedId?: number): Promise<void>;
    /**
     * Pushes local PCM frames to Janus. If the localAudioSource isn't active, it enables it.
     */
    pushLocalAudio(samples: Int16Array, sampleRate: number, channels?: number): void;
    /**
     * Ensures a local audio track is added to the RTCPeerConnection for publishing.
     */
    enableLocalAudio(): void;
    /**
     * Stops the Janus client: ends polling, closes the RTCPeerConnection, etc.
     * Does not destroy or leave the room automatically; call destroyRoom() or leaveRoom() if needed.
     */
    stop(): Promise<void>;
    /**
     * Returns the current Janus sessionId, if any.
     */
    getSessionId(): number | undefined;
    /**
     * Returns the Janus handleId for the publisher, if any.
     */
    getHandleId(): number | undefined;
    /**
     * Returns the Janus publisherId (internal participant ID), if any.
     */
    getPublisherId(): number | undefined;
    /**
     * Creates a new Janus session via POST /janus (with "janus":"create").
     */
    private createSession;
    /**
     * Attaches to the videoroom plugin via /janus/{sessionId} (with "janus":"attach").
     */
    private attachPlugin;
    /**
     * Creates a Janus room for the host scenario.
     * For a guest, this step is skipped (the room already exists).
     */
    private createRoom;
    /**
     * Joins the created room as a publisher, for the host scenario.
     */
    private joinRoom;
    /**
     * Creates an SDP offer and sends "configure" to Janus with it.
     * Used by both host and guest after attach + join.
     */
    private configurePublisher;
    /**
     * Sends a "janus":"message" to the Janus handle, optionally with jsep.
     */
    private sendJanusMessage;
    /**
     * Starts polling /janus/{sessionId}?maxev=1 for events. We parse keepalives, answers, etc.
     */
    private startPolling;
    /**
     * Processes each Janus event received from the poll cycle.
     */
    private handleJanusEvent;
    /**
     * Called whenever we get an SDP "answer" from Janus. Sets the remote description on our PC.
     */
    private onReceivedAnswer;
    /**
     * Sets up events on our main RTCPeerConnection for ICE changes, track additions, etc.
     */
    private setupPeerEvents;
    /**
     * Generates a random transaction ID for Janus requests.
     */
    private randomTid;
    /**
     * Waits for a specific Janus event (e.g., "joined", "attached", etc.)
     * that matches a given predicate. Times out after timeoutMs if not received.
     */
    private waitForJanusEvent;
    /**
     * Destroys the Janus room (host only). Does not close local PC or stop polling.
     */
    destroyRoom(): Promise<void>;
    /**
     * Leaves the Janus room if we've joined. Does not close the local PC or stop polling.
     */
    leaveRoom(): Promise<void>;
}

/**
 * Configuration options for the JanusAudioSource.
 */
interface AudioSourceOptions {
    /**
     * Optional logger instance for debug/info/warn logs.
     */
    logger?: Logger;
}
/**
 * Configuration options for the JanusAudioSink.
 */
interface AudioSinkOptions {
    /**
     * Optional logger instance for debug/info/warn logs.
     */
    logger?: Logger;
}
/**
 * JanusAudioSource wraps a RTCAudioSource, allowing you to push
 * raw PCM frames (Int16Array) into the WebRTC pipeline.
 */
declare class JanusAudioSource extends EventEmitter {
    private source;
    private readonly track;
    private logger?;
    constructor(options?: AudioSourceOptions);
    /**
     * Returns the MediaStreamTrack associated with this audio source.
     */
    getTrack(): MediaStreamTrack;
    /**
     * Pushes PCM data into the RTCAudioSource. Typically 16-bit, single- or multi-channel frames.
     * @param samples - The Int16Array audio samples.
     * @param sampleRate - The sampling rate (e.g., 48000).
     * @param channels - Number of channels (e.g., 1 for mono).
     */
    pushPcmData(samples: Int16Array, sampleRate: number, channels?: number): void;
}
/**
 * JanusAudioSink wraps a RTCAudioSink, providing an event emitter
 * that forwards raw PCM frames (Int16Array) to listeners.
 */
declare class JanusAudioSink extends EventEmitter {
    private sink;
    private active;
    private logger?;
    constructor(track: MediaStreamTrack, options?: AudioSinkOptions);
    /**
     * Stops receiving audio data. Once called, no further 'audioData' events will be emitted.
     */
    stop(): void;
}

/**
 * Configuration object for ChatClient.
 */
interface ChatClientConfig {
    /**
     * The space ID (e.g., "1vOGwAbcdE...") for this audio space.
     */
    spaceId: string;
    /**
     * The access token obtained from accessChat or the live_video_stream/status.
     */
    accessToken: string;
    /**
     * The endpoint host for the chat server (e.g., "https://prod-chatman-ancillary-eu-central-1.pscp.tv").
     */
    endpoint: string;
    /**
     * An instance of Logger for debug/info logs.
     */
    logger: Logger;
}
/**
 * ChatClient handles the WebSocket connection to the Twitter/Periscope chat API.
 * It emits events such as "speakerRequest", "occupancyUpdate", "muteStateChanged", etc.
 */
declare class ChatClient extends EventEmitter {
    private ws?;
    private connected;
    private readonly logger;
    private readonly spaceId;
    private readonly accessToken;
    private endpoint;
    constructor(config: ChatClientConfig);
    /**
     * Establishes a WebSocket connection to the chat endpoint and sets up event handlers.
     */
    connect(): Promise<void>;
    /**
     * Internal method to set up WebSocket event listeners (open, message, close, error).
     */
    private setupHandlers;
    /**
     * Sends two WebSocket messages to authenticate and join the specified space.
     */
    private sendAuthAndJoin;
    /**
     * Sends an emoji reaction to the chat server.
     * @param emoji - The emoji string, e.g. '🔥', '🙏', etc.
     */
    reactWithEmoji(emoji: string): void;
    /**
     * Handles inbound WebSocket messages, parsing JSON payloads
     * and emitting relevant events (speakerRequest, occupancyUpdate, etc.).
     */
    private handleMessage;
    /**
     * Closes the WebSocket connection if open, and resets internal state.
     */
    disconnect(): Promise<void>;
}

/**
 * SttTtsPlugin
 * ------------
 * Provides an end-to-end flow of:
 *  - Speech-to-Text (OpenAI Whisper)
 *  - ChatGPT conversation
 *  - Text-to-Speech (ElevenLabs)
 *  - Streams TTS audio frames back to Janus
 *
 * Lifecycle:
 *  - onAttach(...) => minimal references
 *  - init(...) => space or participant has joined in basic mode
 *  - onJanusReady(...) => we have a JanusClient
 *  - onAudioData(...) => receiving PCM frames from speakers
 *  - cleanup(...) => release resources, stop timers, etc.
 */
declare class SttTtsPlugin implements Plugin {
    private spaceOrParticipant?;
    private janus?;
    private logger?;
    private openAiApiKey?;
    private elevenLabsApiKey?;
    private sttLanguage;
    private gptModel;
    private voiceId;
    private elevenLabsModel;
    private systemPrompt;
    private silenceThreshold;
    /**
     * chatContext accumulates the conversation for GPT:
     *  - system: persona instructions
     *  - user/assistant: running conversation
     */
    private chatContext;
    /**
     * Maps each userId => array of Int16Array PCM chunks
     * Only accumulates data if the speaker is unmuted
     */
    private pcmBuffers;
    /**
     * Tracks which speakers are currently unmuted:
     * userId => true/false
     */
    private speakerUnmuted;
    /**
     * TTS queue for sequential playback
     */
    private ttsQueue;
    private isSpeaking;
    /**
     * Called immediately after `.use(plugin)`.
     * Usually used for storing references or minimal setup.
     */
    onAttach(params: {
        space: Space | SpaceParticipant;
        pluginConfig?: Record<string, any>;
    }): void;
    /**
     * Called after the space/participant has joined in basic mode (listener + chat).
     * This is where we can finalize setup that doesn't require Janus or speaker mode.
     */
    init(params: {
        space: Space | SpaceParticipant;
        pluginConfig?: Record<string, any>;
    }): void;
    /**
     * Called if/when the plugin needs direct access to a JanusClient.
     * For example, once the participant becomes a speaker or if a host
     * has finished setting up Janus.
     */
    onJanusReady(janusClient: JanusClient): void;
    /**
     * onAudioData: triggered for every incoming PCM frame from a speaker.
     * We'll accumulate them if that speaker is currently unmuted.
     */
    onAudioData(data: AudioDataWithUser): void;
    /**
     * handleMute: called when a speaker goes from unmuted to muted.
     * We'll flush their collected PCM => STT => GPT => TTS => push to Janus
     */
    private handleMute;
    /**
     * speakText: Public method to enqueue a text message for TTS output
     */
    speakText(text: string): Promise<void>;
    /**
     * processTtsQueue: Drains the TTS queue in order, sending frames to Janus
     */
    private processTtsQueue;
    /**
     * convertPcmToWav: Creates a temporary WAV file from raw PCM samples
     */
    private convertPcmToWav;
    /**
     * transcribeWithOpenAI: sends the WAV file to OpenAI Whisper
     */
    private transcribeWithOpenAI;
    /**
     * askChatGPT: sends user text to GPT, returns the assistant reply
     */
    private askChatGPT;
    /**
     * elevenLabsTts: fetches MP3 audio from ElevenLabs for a given text
     */
    private elevenLabsTts;
    /**
     * convertMp3ToPcm: uses ffmpeg to convert an MP3 buffer to raw PCM
     */
    private convertMp3ToPcm;
    /**
     * streamToJanus: push PCM frames to Janus in small increments (~10ms).
     */
    private streamToJanus;
    /**
     * setSystemPrompt: update the GPT system prompt at runtime
     */
    setSystemPrompt(prompt: string): void;
    /**
     * setGptModel: switch GPT model (e.g. "gpt-4")
     */
    setGptModel(model: string): void;
    /**
     * addMessage: manually add a system/user/assistant message to the chat context
     */
    addMessage(role: 'system' | 'user' | 'assistant', content: string): void;
    /**
     * clearChatContext: resets the GPT conversation
     */
    clearChatContext(): void;
    /**
     * cleanup: release resources when the space/participant is stopping or plugin removed
     */
    cleanup(): void;
}

/**
 * RecordToDiskPlugin
 * ------------------
 * A simple plugin that writes all incoming PCM frames to a local .raw file.
 *
 * Lifecycle:
 *  - onAttach(...) => minimal references, logger config
 *  - init(...) => finalize file path, open stream
 *  - onAudioData(...) => append PCM frames to the file
 *  - cleanup(...) => close file stream
 */
declare class RecordToDiskPlugin implements Plugin {
    private filePath;
    private outStream?;
    private logger?;
    /**
     * Called immediately after .use(plugin).
     * We create a logger based on pluginConfig.debug and store the file path if provided.
     */
    onAttach(params: {
        space: Space | SpaceParticipant;
        pluginConfig?: Record<string, any>;
    }): void;
    /**
     * Called after the space/participant has joined in basic mode.
     * We open the WriteStream to our file path here.
     */
    init(params: {
        space: Space | SpaceParticipant;
        pluginConfig?: Record<string, any>;
    }): void;
    /**
     * Called whenever PCM audio frames arrive from a speaker.
     * We write them to the file as raw 16-bit PCM.
     */
    onAudioData(data: AudioDataWithUser): void;
    /**
     * Called when the plugin is cleaned up (e.g. space/participant stop).
     * We close our file stream.
     */
    cleanup(): void;
}

/**
 * MonitorAudioPlugin
 * ------------------
 * A simple plugin that spawns an `ffplay` process to play raw PCM audio in real time.
 * It reads frames from `onAudioData()` and writes them to ffplay via stdin.
 *
 * Usage:
 *   const plugin = new MonitorAudioPlugin(48000, /* debug= *\/ true);
 *   space.use(plugin);
 */
declare class MonitorAudioPlugin implements Plugin {
    private readonly sampleRate;
    private ffplay?;
    private logger;
    /**
     * @param sampleRate  The expected PCM sample rate (e.g. 16000 or 48000).
     * @param debug       If true, enables debug logging via Logger.
     */
    constructor(sampleRate?: number, debug?: boolean);
    /**
     * Called whenever PCM frames arrive (from a speaker).
     * Writes frames to ffplay's stdin to play them in real time.
     */
    onAudioData(data: AudioDataWithUser): void;
    /**
     * Cleanup is called when the plugin is removed or when the space/participant stops.
     * Ends the ffplay process and closes its stdin pipe.
     */
    cleanup(): void;
}

/**
 * IdleMonitorPlugin
 * -----------------
 * Monitors silence in both remote speaker audio and local (pushed) audio.
 * If no audio is detected for a specified duration, it emits an 'idleTimeout' event on the space.
 */
declare class IdleMonitorPlugin implements Plugin {
    private idleTimeoutMs;
    private checkEveryMs;
    private space?;
    private logger?;
    private lastSpeakerAudioMs;
    private lastLocalAudioMs;
    private checkInterval?;
    /**
     * @param idleTimeoutMs The duration (in ms) of total silence before triggering idle. (Default: 60s)
     * @param checkEveryMs  How frequently (in ms) to check for silence. (Default: 10s)
     */
    constructor(idleTimeoutMs?: number, checkEveryMs?: number);
    /**
     * Called immediately after .use(plugin).
     * Allows for minimal setup, including obtaining a debug logger if desired.
     */
    onAttach(params: {
        space: Space;
        pluginConfig?: Record<string, any>;
    }): void;
    /**
     * Called once the space has fully initialized (basic mode).
     * We set up idle checks and override pushAudio to detect local audio activity.
     */
    init(params: {
        space: Space;
        pluginConfig?: Record<string, any>;
    }): void;
    /**
     * Checks if we've exceeded idleTimeoutMs with no audio activity.
     * If so, emits an 'idleTimeout' event on the space with { idleMs } info.
     */
    private checkIdle;
    /**
     * Returns how many milliseconds have passed since any audio was detected (local or speaker).
     */
    getIdleTimeMs(): number;
    /**
     * Cleans up resources (interval) when the plugin is removed or space stops.
     */
    cleanup(): void;
}

/**
 * HlsRecordPlugin
 * ---------------
 * Records the final Twitter Spaces HLS mix to a local .ts file using ffmpeg.
 *
 * Workflow:
 *  - Wait for occupancy > 0 (i.e., at least one listener).
 *  - Attempt to retrieve the HLS URL from Twitter (via scraper).
 *  - If valid (HTTP 200), spawn ffmpeg to record the stream.
 *  - If HLS not ready yet (HTTP 404), wait for next occupancy event.
 *
 * Lifecycle:
 *  - onAttach(...) => minimal references, logger setup
 *  - init(...) => fully runs once the Space is created (broadcastInfo ready)
 *  - cleanup() => stop ffmpeg if running
 */
declare class HlsRecordPlugin implements Plugin {
    private logger?;
    private recordingProcess?;
    private isRecording;
    private outputPath?;
    private mediaKey?;
    private space?;
    /**
     * You can optionally provide an outputPath in the constructor.
     * Alternatively, it can be set via pluginConfig in onAttach/init.
     */
    constructor(outputPath?: string);
    /**
     * Called immediately after .use(plugin). We store references here
     * (e.g., the space) and create a Logger based on pluginConfig.debug.
     */
    onAttach(params: {
        space: Space;
        pluginConfig?: Record<string, any>;
    }): void;
    /**
     * Called once the Space has fully initialized (broadcastInfo is ready).
     * We retrieve the media_key from the broadcast, subscribe to occupancy,
     * and prepare for recording if occupancy > 0.
     */
    init(params: {
        space: Space;
        pluginConfig?: Record<string, any>;
    }): Promise<void>;
    /**
     * If occupancy > 0 and we're not recording yet, attempt to fetch the HLS URL
     * from Twitter. If it's ready, spawn ffmpeg to record.
     */
    private handleOccupancyUpdate;
    /**
     * HEAD request to see if the HLS URL is returning 200 OK.
     * maxRetries=1 => only try once here; rely on occupancy re-calls otherwise.
     */
    private waitForHlsReady;
    /**
     * Spawns ffmpeg to record the HLS stream at the given URL.
     */
    private startRecording;
    /**
     * Called when the plugin is cleaned up (e.g. space.stop()).
     * Kills ffmpeg if still running.
     */
    cleanup(): void;
}

export { type Admin, type AudioData, type AudioDataWithUser, type AudioSpace, type AudioSpaceByIdResponse, type AudioSpaceByIdVariables, type AuthenticatePeriscopeResponse, type BroadcastCreated, type BrowseSpaceTopics, type BrowseSpaceTopicsResponse, type Category, ChatClient, type Community, type CommunitySelectQueryResponse, type CreatorResult, type GuestReaction, HlsRecordPlugin, IdleMonitorPlugin, JanusAudioSink, JanusAudioSource, JanusClient, type LiveVideoSource, type LiveVideoStreamStatus, Logger, type LoginTwitterTokenResponse, type Metadata, MonitorAudioPlugin, type OccupancyUpdate, type Participants, type Plugin, type PluginRegistration, type Profile, type QueryProfilesResponse, type QueryTweetsResponse, RecordToDiskPlugin, Scraper, SearchMode, type Sharings, Space, SpaceParticipant, type SpeakerInfo, type SpeakerRequest, SttTtsPlugin, type Subtopic, type TurnServersInfo, type Tweet, type UserResults };
