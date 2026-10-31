import { Button } from "@/components/ui/button";
import { useEffect, useState, type ComponentProps } from "react";
import { useSocial, useSocialResource, type Issue } from "./client";
import { Schedule as LocalSchedule } from "../marketing/modules";
import { Icon } from "../components/ui/icon";

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
    <Button disabled={loading} onClick={onClick}>
      <Icon name="redo" size={15} />
      {loading ? "Loading…" : "Refresh"}
    </Button>
  );
}
export type ProviderPost = {
  id: string;
  provider: "tebar";
  content: string;
  status: string;
  scheduledFor?: string;
  publishedAt?: string;
  platform?: string;
  accountId?: string;
  accountName?: string;
  permalink?: string;
  error?: string;
};
type PostsResponse = {
  posts: ProviderPost[];
  issues: Issue[];
  nextCursor?: string | null;
};
export function Schedule({
  onProviderPosts,
  ...props
}: ComponentProps<typeof LocalSchedule> & {
  onProviderPosts?: (posts: ProviderPost[]) => Promise<void>;
}) {
  const social = useSocial(),
    enabled = social.config.tebar.configured;
  const [cursor, setCursor] = useState<string | undefined>(),
    [collected, setCollected] = useState<ProviderPost[]>([]),
    [syncError, setSyncError] = useState("");
  const feed = useSocialResource<PostsResponse>("posts", { cursor }, enabled);
  useEffect(() => {
    setCollected([]);
    setCursor(undefined);
  }, [social.revision]);
  useEffect(() => {
    if (feed.data)
      setCollected((old) =>
        !cursor
          ? feed.data!.posts
          : [
              ...new Map(
                [...old, ...feed.data!.posts].map((post) => [
                  `${post.provider}:${post.id}:${post.accountId}`,
                  post,
                ]),
              ).values(),
            ],
      );
  }, [feed.data, cursor]);
  useEffect(() => {
    if (!feed.data || !onProviderPosts) return;
    let live = true;
    void onProviderPosts(feed.data.posts)
      .then(() => {
        if (live) setSyncError("");
      })
      .catch((error) => {
        if (live)
          setSyncError(
            `Could not update linked Content tasks: ${String(error)}`,
          );
      });
    return () => {
      live = false;
    };
  }, [feed.data, onProviderPosts]);
  return (
    <div className={enabled ? "social-connected" : ""}>
      {enabled && (
        <section className="social-data-panel">
          <div className="panel-heading">
            <div>
              <h2>Published & scheduled</h2>
              <p>
                Read directly from Tebar. Refresh when you need updated delivery
                status.
              </p>
            </div>
            <Refresh
              loading={feed.loading}
              onClick={() => {
                setCursor(undefined);
                feed.refresh();
              }}
            />
          </div>
          <Issues error={feed.error} issues={feed.data?.issues} />
          {syncError && (
            <p role="alert" className="error">
              {syncError}
            </p>
          )}
          {collected.map((post) => (
            <article
              key={`${post.provider}:${post.id}:${post.accountId}`}
              className="live-post-list"
            >
              <p>
                <strong>{post.content || "Media post"}</strong>
              </p>
              <small>
                Tebar · {post.accountName || post.platform} · {post.status}{" "}
                {post.scheduledFor
                  ? `· ${new Date(post.scheduledFor).toLocaleString()}`
                  : ""}
              </small>
              {post.error && <p className="error">{post.error}</p>}
              {post.permalink && /^https:\/\//.test(post.permalink) && (
                <p>
                  <a href={post.permalink} target="_blank" rel="noreferrer">
                    View published post
                  </a>
                </p>
              )}
            </article>
          ))}
          {!collected.length && !feed.loading && (
            <p>No provider posts have been saved yet.</p>
          )}
          {feed.data?.nextCursor && (
            <Button
              disabled={feed.loading}
              onClick={() => setCursor(feed.data?.nextCursor || undefined)}
            >
              Load more posts
            </Button>
          )}
        </section>
      )}
      <LocalSchedule {...props} />
    </div>
  );
}
