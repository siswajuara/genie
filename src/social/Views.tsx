import { useEffect, useState, type ComponentProps } from "react";
import {
  useSocial,
  useSocialResource,
  openSocialUrl,
  type Issue,
} from "./client";
import { Schedule as LocalSchedule } from "../marketing/Modules";
import { Icon } from "../components/ui/Icon";
import {
  SelectField,
  DateRangePicker,
  dateISO,
} from "../components/ui/Controls";
import {
  Dialog,
  EmptyState,
  PageIntro,
  PlatformIcon,
} from "../marketing/Shared";
import type { DateRange } from "react-day-picker";

function Issues({ issues, error }: { issues?: Issue[]; error?: string }) {
  return (
    <>
      {error && (
        <p className="error social-read-error" role="alert">
          {error}
        </p>
      )}
      {issues?.map((issue) => (
        <p
          className="error social-read-error"
          role="alert"
          key={`${issue.provider}:${issue.message}`}
        >
          {issue.provider}: {issue.message}
        </p>
      ))}
    </>
  );
}
function Refresh({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button disabled={loading} onClick={onClick}>
      <Icon name="redo" size={15} />
      {loading ? "Loading…" : "Refresh"}
    </button>
  );
}
type ProviderPost = {
  id: string;
  provider: "buffer" | "zernio";
  content: string;
  status: string;
  scheduledFor?: string;
  publishedAt?: string;
  platform?: string;
  accountId?: string;
};
type PostsResponse = {
  posts: ProviderPost[];
  issues: Issue[];
  bufferCursor?: string;
  zernioHasMore?: boolean;
};
export function Schedule(props: ComponentProps<typeof LocalSchedule>) {
  const social = useSocial(),
    enabled =
      social.config.buffer.configured || social.config.zernio.configured;
  const [status, setStatus] = useState("All provider posts"),
    [provider, setProvider] = useState("all"),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [collected, setCollected] = useState<ProviderPost[]>([]);
  const feed = useSocialResource<PostsResponse>(
    "posts",
    { zernioPage: page },
    enabled,
  );
  useEffect(() => {
    setCollected([]);
    setPage(1);
  }, [social.revision]);
  useEffect(() => {
    if (feed.data)
      setCollected((old) =>
        page === 1
          ? feed.data!.posts
          : [
              ...new Map(
                [...old, ...feed.data!.posts].map((post) => [
                  `${post.provider}:${post.id}`,
                  post,
                ]),
              ).values(),
            ],
      );
  }, [feed.data, page]);
  const filtered = collected
    .filter(
      (post) =>
        (provider === "all" || post.provider === provider) &&
        post.content?.toLowerCase().includes(query.toLowerCase()) &&
        (status === "All provider posts" ||
          post.status?.toLowerCase().includes(status.toLowerCase())),
    )
    .sort((a, b) =>
      (a.scheduledFor || a.publishedAt || "").localeCompare(
        b.scheduledFor || b.publishedAt || "",
      ),
    );
  return (
    <div className={enabled ? "social-connected" : ""}>
      <LocalSchedule {...props} />
    </div>
  );
}
type Metric = {
  type?: string;
  name: string;
  value: number | null;
  unit?: string;
  description?: string;
};
type AnalyticsPost = {
  _id?: string;
  id?: string;
  content?: string;
  platform?: string;
  publishedAt?: string;
  analytics?: Record<string, number | null>;
  platforms?: {
    platform?: string;
    analytics?: Record<string, number | null>;
  }[];
};
type InsightsResponse = {
  buffer?: { metricsUpdatedAt?: string; metrics: Metric[] } | null;
  zernio?: {
    posts?: AnalyticsPost[];
    overview?: Record<string, number | null>;
    pagination?: { hasMore?: boolean };
  } | null;
  issues: Issue[];
};
export function Insight({ onSettings }: { onSettings: () => void }) {
  const social = useSocial(),
    [account, setAccount] = useState(""),
    [range, setRange] = useState<DateRange | undefined>(() => {
      const to = new Date(),
        from = new Date();
      from.setDate(to.getDate() - 29);
      return { from, to };
    });
  const enabled =
    (social.config.buffer.configured || social.config.zernio.configured) &&
    !!range?.from &&
    !!range?.to;
  const result = useSocialResource<InsightsResponse>(
    "insights",
    {
      fromDate: range?.from ? dateISO(range.from) : "",
      toDate: range?.to ? dateISO(range.to) : "",
      accountKey: account,
    },
    enabled,
  );
  const posts = result.data?.zernio?.posts || [],
    metricNames = [
      "impressions",
      "reach",
      "views",
      "likes",
      "comments",
      "shares",
      "saves",
      "clicks",
    ];
  return (
    <>
      <PageIntro
        title="Know what connects."
        description="Performance reported by your connected social providers."
        action={<Refresh loading={result.loading} onClick={result.refresh} />}
      />
      <div className="insight-filters">
        <SelectField
          label="Insight account"
          value={account}
          onChange={setAccount}
          options={[
            { value: "", label: "All connected accounts" },
            ...social.accounts.map((a) => ({
              value: a.key,
              label: `${a.name} · ${a.provider}`,
            })),
          ]}
        />
        <DateRangePicker
          label="Insight date range"
          value={range}
          onChange={setRange}
        />
      </div>
      <Issues issues={result.data?.issues} error={result.error} />
      {!enabled ? (
        <EmptyState
          icon="insight"
          title="Connect an account to see your results"
          description="Save and test a Buffer or Zernio API key in Setting, then choose a complete date range."
          action={<button onClick={onSettings}>Social accounts</button>}
        />
      ) : (
        <>
          {result.loading && <p role="status">Loading insights…</p>}
          {result.data?.buffer && (
            <section className="social-data-panel">
              <div className="panel-heading">
                <div>
                  <h2>Buffer aggregate metrics</h2>
                  <p>
                    Reported for the selected accounts and date range. Each
                    platform counts metrics differently.
                  </p>
                </div>
                {result.data.buffer.metricsUpdatedAt && (
                  <small>
                    Updated{" "}
                    {new Date(
                      result.data.buffer.metricsUpdatedAt,
                    ).toLocaleString()}
                  </small>
                )}
              </div>
              <div className="insight-metrics">
                {result.data.buffer.metrics.map((metric, index) => (
                  <div key={`${metric.type || metric.name}:${index}`}>
                    <span>{metric.name}</span>
                    <strong>
                      {typeof metric.value === "number"
                        ? metric.value.toLocaleString()
                        : "Not reported"}
                    </strong>
                    <small>
                      {metric.unit} {metric.description}
                    </small>
                  </div>
                ))}
              </div>
              {!result.data.buffer.metrics.length && (
                <p>No Buffer metrics were reported for this period.</p>
              )}
            </section>
          )}
          {result.data?.zernio && (
            <section className="social-data-panel">
              <div className="panel-heading">
                <div>
                  <h2>Zernio post insights</h2>
                  <p>
                    Lifetime post metrics for posts returned in the selected
                    period. Kept separate from Buffer aggregates.
                  </p>
                </div>
              </div>
              {result.data.zernio.overview && (
                <div className="insight-metrics">
                  {Object.entries(result.data.zernio.overview)
                    .filter(([, value]) => typeof value === "number")
                    .map(([key, value]) => (
                      <div key={key}>
                        <span>{key.replace(/([A-Z])/g, " $1")}</span>
                        <strong>{value?.toLocaleString()}</strong>
                      </div>
                    ))}
                </div>
              )}
              {posts.length ? (
                <div className="social-table-wrap">
                  <table className="social-table">
                    <thead>
                      <tr>
                        <th>Post</th>
                        {metricNames.map((key) => (
                          <th key={key}>{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {posts.map((post, index) => (
                        <tr key={post._id || post.id || index}>
                          <td>
                            <strong>
                              {post.content || post.platform || "Media post"}
                            </strong>
                            <small>
                              {post.platform ||
                                post.platforms
                                  ?.map((p) => p.platform)
                                  .join(", ")}
                            </small>
                          </td>
                          {metricNames.map((key) => {
                            const value = post.analytics?.[key];
                            return (
                              <td key={key}>
                                {typeof value === "number"
                                  ? value.toLocaleString()
                                  : "Not reported"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No Zernio post metrics were reported in this period.</p>
              )}
              <p className="marketing-footnote">
                Up to 50 posts. Metrics availability depends on account
                permissions, platform limits, and provider plan.
              </p>
            </section>
          )}
          {!result.loading &&
            !result.error &&
            !result.data?.buffer &&
            !result.data?.zernio && (
              <EmptyState
                icon="insight"
                title="No metrics returned"
                description="Review the provider messages above and check API permissions or the selected dates."
              />
            )}
        </>
      )}
    </>
  );
}
type CommentPost = {
  id: string;
  accountId: string;
  platform: string;
  content?: string;
  accountUsername?: string;
  commentCount?: number;
  createdTime?: string;
  isAd?: boolean;
};
type Comment = {
  id: string;
  message?: string;
  createdTime?: string;
  from?: { name?: string; username?: string };
  canReply?: boolean;
  replyCount?: number;
  replies?: Comment[];
};
type Inbox = {
  data?: CommentPost[];
  posts?: CommentPost[];
  nextCursor?: string;
  pagination?: { nextCursor?: string; hasMore?: boolean };
};
type Comments = {
  comments?: Comment[];
  nextCursor?: string;
  pagination?: { nextCursor?: string; hasMore?: boolean };
};
export function Community({ onSettings }: { onSettings: () => void }) {
  const social = useSocial(),
    [search, setSearch] = useState(""),
    [platform, setPlatform] = useState(""),
    [selected, setSelected] = useState<CommentPost>(),
    [comment, setComment] = useState<Comment>(),
    [message, setMessage] = useState(""),
    [confirm, setConfirm] = useState(false),
    [sending, setSending] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [cursor, setCursor] = useState(""),
    [posts, setPosts] = useState<CommentPost[]>([]),
    [threadCursor, setThreadCursor] = useState(""),
    [comments, setComments] = useState<Comment[]>([]),
    [replies, setReplies] = useState<Record<string, Comment[]>>({});
  const [replyId, setReplyId] = useState(() => crypto.randomUUID());
  const inbox = useSocialResource<Inbox>(
    "inbox",
    { cursor, platform },
    social.config.zernio.configured,
  );
  const thread = useSocialResource<Comments>(
    "comments",
    {
      postId: selected?.id,
      accountId: selected?.accountId,
      cursor: threadCursor,
    },
    !!selected && social.config.zernio.configured,
  );
  useEffect(() => {
    setSelected(undefined);
    setComment(undefined);
    setPosts([]);
    setComments([]);
    setReplies({});
    setCursor("");
    setThreadCursor("");
  }, [social.revision]);
  useEffect(() => {
    if (inbox.data) {
      const rows = (inbox.data.data || inbox.data.posts || []).filter(
        (p) => !p.isAd,
      );
      setPosts((old) =>
        cursor
          ? [
              ...new Map(
                [...old, ...rows].map((p) => [`${p.accountId}:${p.id}`, p]),
              ).values(),
            ]
          : rows,
      );
    }
  }, [inbox.data, cursor]);
  useEffect(() => {
    if (thread.data)
      setComments((old) =>
        threadCursor
          ? [
              ...new Map(
                [...old, ...(thread.data!.comments || [])].map((c) => [
                  c.id,
                  c,
                ]),
              ).values(),
            ]
          : thread.data!.comments || [],
      );
  }, [thread.data, threadCursor]);
  function choose(post: CommentPost) {
    setSelected(post);
    setComment(undefined);
    setComments([]);
    setReplies({});
    setThreadCursor("");
    setMessage("");
    setError("");
    setNotice("");
    setReplyId(crypto.randomUUID());
  }
  async function sendReply() {
    if (!selected || !comment?.canReply || !message.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await social.request("reply", {
        requestId: replyId,
        postId: selected.id,
        accountId: selected.accountId,
        commentId: comment.id,
        message,
      });
      setMessage("");
      setConfirm(false);
      setNotice("Reply sent to the social channel.");
      setReplyId(crypto.randomUUID());
      thread.refresh();
    } catch (err) {
      setError(
        `${String(err)} Check the thread before retrying if delivery is uncertain.`,
      );
    } finally {
      setSending(false);
    }
  }
  const filtered = posts.filter((p) =>
    `${p.content || ""} ${p.accountUsername || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageIntro
        title="Keep the conversation going."
        description="Read social comments and send replies through Zernio."
        action={
          <Refresh
            loading={inbox.loading}
            onClick={() => {
              setCursor("");
              inbox.refresh();
            }}
          />
        }
      />
      <p className="social-coverage-note">
        Buffer does not expose comment listing or replies in its public API.
        Zernio covers connected accounts with Inbox access; its feed can be
        cached for up to ten minutes. Ads comments are managed in Zernio.
      </p>
      {social.config.zernio.configured ? (
        <>
          <Issues error={inbox.error} />
          <div className="community-layout">
            <section className="community-inbox">
              <div className="community-inbox-head">
                <input
                  aria-label="Search comment posts"
                  placeholder="Search posts or people"
                  value={search}
                  onChange={(ev) => setSearch(ev.target.value)}
                />
                <SelectField
                  label="Comment platform"
                  value={platform}
                  onChange={(value) => {
                    setPlatform(value);
                    setCursor("");
                    setPosts([]);
                    setSelected(undefined);
                  }}
                  options={[
                    { value: "", label: "All Zernio channels" },
                    ...[
                      ...new Set(
                        social.accounts
                          .filter((a) => a.provider === "zernio")
                          .map((a) => a.platform),
                      ),
                    ].map((value) => ({ value, label: value })),
                  ]}
                />
              </div>
              <div className="live-inbox-posts">
                {filtered.map((post) => (
                  <button
                    aria-pressed={
                      selected?.id === post.id &&
                      selected.accountId === post.accountId
                    }
                    key={`${post.accountId}:${post.id}`}
                    onClick={() => choose(post)}
                  >
                    <PlatformIcon id={post.platform} />
                    <span>
                      <strong>{post.content || "Social post"}</strong>
                      <small>
                        {post.accountUsername} ·{" "}
                        {post.commentCount ?? "Unreported"} comments
                      </small>
                    </span>
                  </button>
                ))}
                {!filtered.length && !inbox.loading && (
                  <EmptyState
                    icon="chat"
                    title="No comment posts returned"
                    description="Try another platform or check your Zernio Inbox permissions."
                  />
                )}
                {inbox.loading && <p role="status">Loading comment posts…</p>}
                {(inbox.data?.nextCursor ||
                  inbox.data?.pagination?.nextCursor) && (
                  <button
                    disabled={inbox.loading}
                    onClick={() =>
                      setCursor(
                        inbox.data!.nextCursor ||
                          inbox.data!.pagination!.nextCursor!,
                      )
                    }
                  >
                    Load more posts
                  </button>
                )}
              </div>
            </section>
            <section className="community-thread">
              {selected ? (
                <>
                  <div className="live-thread-heading">
                    <h2>{selected.content || "Post comments"}</h2>
                    <small>
                      {selected.platform} · {selected.accountUsername}
                    </small>
                    <Refresh
                      loading={thread.loading}
                      onClick={() => {
                        setThreadCursor("");
                        thread.refresh();
                      }}
                    />
                  </div>
                  <Issues error={thread.error} />
                  <div className="live-comments">
                    {comments.map((item) => (
                      <article
                        className={comment?.id === item.id ? "selected" : ""}
                        key={item.id}
                      >
                        <button
                          onClick={() => {
                            setComment(item);
                            setMessage("");
                            setReplyId(crypto.randomUUID());
                          }}
                        >
                          <strong>
                            {item.from?.name ||
                              item.from?.username ||
                              "Social user"}
                          </strong>
                          <p>{item.message}</p>
                          <small>
                            {item.createdTime
                              ? new Date(item.createdTime).toLocaleString()
                              : ""}{" "}
                            ·{" "}
                            {item.canReply
                              ? "Can reply"
                              : "Replies unavailable"}
                          </small>
                        </button>
                        {(item.replies || []).map((reply) => (
                          <div className="comment-reply" key={reply.id}>
                            <strong>
                              {reply.from?.name ||
                                reply.from?.username ||
                                "Reply"}
                            </strong>
                            <p>{reply.message}</p>
                          </div>
                        ))}
                        {(item.replyCount || 0) > 0 && (
                          <button
                            onClick={async () => {
                              try {
                                const result = await social.request<Comments>(
                                  "comments",
                                  {
                                    postId: selected.id,
                                    accountId: selected.accountId,
                                    commentId: item.id,
                                  },
                                );
                                setReplies((old) => ({
                                  ...old,
                                  [`${selected.id}:${item.id}`]:
                                    result.comments || [],
                                }));
                              } catch (err) {
                                setError(String(err));
                              }
                            }}
                          >
                            Load replies
                          </button>
                        )}
                        {replies[`${selected.id}:${item.id}`]?.map((reply) => (
                          <div
                            className="comment-reply"
                            key={`loaded:${reply.id}`}
                          >
                            <strong>
                              {reply.from?.name ||
                                reply.from?.username ||
                                "Reply"}
                            </strong>
                            <p>{reply.message}</p>
                          </div>
                        ))}
                      </article>
                    ))}
                    {thread.loading && <p role="status">Loading comments…</p>}
                    {!thread.loading && !comments.length && !thread.error && (
                      <p>No comments returned for this post.</p>
                    )}
                    {(thread.data?.nextCursor ||
                      thread.data?.pagination?.nextCursor) && (
                      <button
                        disabled={thread.loading}
                        onClick={() =>
                          setThreadCursor(
                            thread.data!.nextCursor ||
                              thread.data!.pagination!.nextCursor!,
                          )
                        }
                      >
                        Load more comments
                      </button>
                    )}
                  </div>
                  <div className="community-reply-preview">
                    <label htmlFor="live-reply">
                      {comment
                        ? `Reply to ${comment.from?.name || comment.from?.username || "selected comment"}`
                        : "Select a comment to reply"}
                    </label>
                    <textarea
                      id="live-reply"
                      disabled={!comment?.canReply || sending}
                      value={message}
                      onChange={(ev) => setMessage(ev.target.value)}
                      rows={4}
                      maxLength={5000}
                      placeholder="Write your reply"
                    />
                    <button
                      className="primary"
                      disabled={
                        !comment?.canReply || !message.trim() || sending
                      }
                      onClick={() => setConfirm(true)}
                    >
                      Review reply
                    </button>
                    {notice && <p role="status">{notice}</p>}
                    <Issues error={error} />
                  </div>
                </>
              ) : (
                <EmptyState
                  icon="community"
                  title="Choose a post to read its comments"
                  description="Select a post from the inbox, then choose a comment to reply."
                />
              )}
            </section>
          </div>
        </>
      ) : (
        <EmptyState
          icon="community"
          title="Connect Zernio to open your inbox"
          description="Save your Zernio key and connect accounts in Setting. Inbox access depends on your provider plan and social platform."
          action={<button onClick={onSettings}>Social accounts</button>}
        />
      )}{" "}
      {confirm && (
        <Dialog
          title="Send this reply?"
          description="Your reply will appear on the original social channel."
          onClose={() => {
            if (!sending) setConfirm(false);
          }}
        >
          <p>{message}</p>
          <small>
            {selected?.platform} · {selected?.accountUsername}
          </small>
          <Issues error={error} />
          <div className="dialog-footer">
            <button disabled={sending} onClick={() => setConfirm(false)}>
              Keep editing
            </button>
            <button
              className="primary"
              disabled={sending}
              onClick={() => void sendReply()}
            >
              {sending ? "Sending…" : "Send reply"}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
