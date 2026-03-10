'use client';

export type PostItem = {
  id: string;
  title?: string;
  body?: string;
  createdAt?: string;
  imageUrl?: string | null;
};

type ProfilePostsProps = {
  posts: PostItem[];
  isLoading?: boolean;
  className?: string;
};

function PostCard({ post }: { post: PostItem }) {
  return (
    <article className="rounded-xl border border-white/10 dark:border-slate-600/50 bg-white/5 dark:bg-slate-800/40 overflow-hidden shadow hover:shadow-lg transition">
      {post.imageUrl ? (
        <div className="aspect-square bg-slate-200 dark:bg-slate-700">
          <img
            src={post.imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="aspect-square bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center">
          <span className="text-4xl text-slate-300 dark:text-slate-500">📝</span>
        </div>
      )}
      {post.title && (
        <div className="p-3">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
            {post.title}
          </p>
        </div>
      )}
    </article>
  );
}

export function ProfilePosts({ posts, isLoading = false, className = '' }: ProfilePostsProps) {
  if (isLoading) {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="aspect-square rounded-xl bg-slate-200/50 dark:bg-slate-700/30 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div
        className={`rounded-xl border border-dashed border-white/20 dark:border-slate-600 bg-white/5 dark:bg-slate-800/20 p-12 text-center ${className}`}
      >
        <p className="text-slate-500 dark:text-slate-400">Пока нет публикаций.</p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
