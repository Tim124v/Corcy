'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../../../store/auth';
import { getProfile, getUserPosts, type ProfileUser, type PostItem } from '../../../lib/profileService';
import { ProfileAvatar } from '../../../components/profile/ProfileAvatar';
import { ProfileActionButtons } from '../../../components/profile/ProfileActionButtons';
import { ProfileStatsSocial } from '../../../components/profile/ProfileStatsSocial';
import { ProfileTabs, type ProfileTabId } from '../../../components/profile/ProfileTabs';
import { ProfilePosts } from '../../../components/profile/ProfilePosts';
import { useCurrentUserAvatar } from '../../../hooks/use-current-user-avatar';

const initials = (name?: string | null, email?: string) => {
  if (name?.trim()) {
    return name.trim().split(/\s+/).map((p) => p[0]?.toUpperCase()).slice(0, 2).join('');
  }
  if (email) return email[0]?.toUpperCase() ?? '?';
  return '?';
};

export default function ProfileByIdPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : null;
  const { user: currentUser, accessToken } = useAuthStore();

  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTabId>('posts');
  const currentUserPhoto = useCurrentUserAvatar(currentUser?.id, currentUser?.avatarUrl);

  const loadProfile = useCallback(async () => {
    if (!accessToken) {
      router.replace('/');
      return;
    }
    setLoading(true);
    try {
      const data = await getProfile(id ?? 'me', accessToken);
      setProfile(data);
      if (data?.id) {
        setPostsLoading(true);
        const list = await getUserPosts(data.id);
        setPosts(list);
      }
    } finally {
      setLoading(false);
      setPostsLoading(false);
    }
  }, [id, accessToken, router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const isCurrentUser = Boolean(currentUser && profile && currentUser.id === profile.id);

  if (!accessToken) return null;
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <div className="h-64 rounded-xl bg-slate-200/50 dark:bg-slate-800/50 animate-pulse" />
        </div>
      </main>
    );
  }
  if (!profile) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <p className="text-slate-500 dark:text-slate-400">Профиль не найден.</p>
          <Link href="/" className="text-blue-500 hover:underline mt-2 inline-block">На главную</Link>
        </div>
      </main>
    );
  }

  const displayName = profile.name?.trim() || 'Без имени';
  const handle = profile.email.replace(/@.*$/, '') || 'user';

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="container mx-auto max-w-4xl px-4 py-6 sm:py-8 space-y-8">
        <header className="flex items-center gap-4">
          <Link href="/" className="text-sm text-slate-600 dark:text-slate-400 hover:text-blue-500 transition">
            ← Назад
          </Link>
        </header>

        <section className="rounded-xl border border-white/10 dark:border-slate-600/50 bg-white dark:bg-slate-800/40 backdrop-blur shadow-xl p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start gap-6">
            <ProfileAvatar
              src={isCurrentUser ? currentUserPhoto : null}
              alt={displayName}
              initials={initials(profile.name, profile.email)}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
                {displayName}
              </h1>
              <p className="text-slate-500 dark:text-slate-400">@{handle}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Приватные чаты и комнаты только для тех, кому вы доверяете.
              </p>
              <div className="mt-4">
                <ProfileActionButtons
                  isCurrentUser={isCurrentUser}
                  onEdit={isCurrentUser ? () => router.push('/profile') : undefined}
                />
              </div>
              <div className="mt-6">
                <ProfileStatsSocial followers={0} following={0} posts={posts.length} />
              </div>
            </div>
          </div>
        </section>

        <section>
          <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="mt-6">
            {activeTab === 'posts' && (
              <ProfilePosts posts={posts} isLoading={postsLoading} />
            )}
            {activeTab === 'media' && (
              <ProfilePosts posts={[]} className="mt-0" />
            )}
            {activeTab === 'likes' && (
              <ProfilePosts posts={[]} className="mt-0" />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
