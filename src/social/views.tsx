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
  const [page, setPage] = useState(1),
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
                  `${post.provider}:${post.id}:${post.accountId}`,
                  post,
                ]),
              ).values(),
            ],
      );
  }, [feed.data, page]);
  return (
    <div className={enabled ? "social-connected" : ""}>
      {enabled && (
        <section className="social-data-panel">
          <div className="panel-heading">
            <div>
              <h2>Published & scheduled</h2>
              <p>
                Read directly from Buffer and Zernio. Refresh when you need
                updated delivery status.
              </p>
            </div>
            <Refresh
              loading={feed.loading}
              onClick={() => {
                setPage(1);
                feed.refresh();
              }}
            />
          </div>
          <Issues error={feed.error} issues={feed.data?.issues} />
          {collected.map((post) => (
            <article
              key={`${post.provider}:${post.id}:${post.accountId}`}
              className="live-post-list"
            >
              <p>
                <strong>{post.content || "Media post"}</strong>
              </p>
              <small>
                {post.provider} · {post.platform} · {post.status}{" "}
                {post.scheduledFor
                  ? `· ${new Date(post.scheduledFor).toLocaleString()}`
                  : ""}
              </small>
            </article>
          ))}
          {!collected.length && !feed.loading && (
            <p>No provider posts have been saved yet.</p>
          )}
          {feed.data?.zernioHasMore && (
            <Button
              disabled={feed.loading}
              onClick={() => setPage((p) => p + 1)}
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
