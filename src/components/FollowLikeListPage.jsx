import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { App } from '@capacitor/app';
import { FiChevronLeft } from 'react-icons/fi';
import { supabase, AVATAR_BUCKET } from '../supabase';
import { pushBackAction, popBackAction, runBackAction, navigateBackOrFallback, canGoBackInHistory } from '../services/backNavigation';
import './FollowLikeListModal.css';

function FollowLikeListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profileId, type } = useParams();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [followMap, setFollowMap] = useState({});

  const normalizedType = type === 'followers' ? 'followers' : type === 'following' ? 'following' : type === 'likes' ? 'likes' : null;

  const handleGoBack = useCallback(async () => {
    const returnPath = location.state?.returnPath || '/home';
    const sourceProfile = location.state?.sourceProfile;

    if (sourceProfile?.id) {
      try {
        sessionStorage.setItem('joblinkPendingProfileRestore', JSON.stringify({
          profileId: sourceProfile.id,
          profile: sourceProfile,
        }));
      } catch (error) {
        console.warn('FollowLikeListPage: failed to persist profile restore state', error);
      }

      if (canGoBackInHistory()) {
        navigate(-1);
        return;
      }

      navigate(returnPath, {
        state: {
          highlightProfileId: sourceProfile.id,
          highlightProfile: sourceProfile,
        },
      });
      return;
    }

    navigateBackOrFallback(navigate, '/home');
  }, [location.state, navigate]);

  useEffect(() => {
    pushBackAction(handleGoBack);

    let backButtonListener;
    App.addListener('backButton', async () => {
      const handled = await runBackAction();
      if (!handled) {
        await handleGoBack();
      }
    }).then((listener) => {
      backButtonListener = listener;
    }).catch(() => {});

    return () => {
      popBackAction(handleGoBack);
      if (backButtonListener) {
        backButtonListener.remove().catch(() => {});
      }
    };
  }, [handleGoBack]);

  useEffect(() => {
    // get current auth user id
    let mounted = true;
    supabase.auth.getUser().then(({ data: { user } = {} }) => {
      if (!mounted || !user) return;
      setCurrentUserId(user.id);
    }).catch(() => {});

    if (!profileId || !normalizedType) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchItems = async () => {
      setLoading(true);
      setError(null);
      setItems([]);

      try {
        const sourceTable = normalizedType === 'likes' ? 'likes' : 'follows';
        const profileField = normalizedType === 'followers'
          ? 'followed_id'
          : normalizedType === 'following'
            ? 'follower_id'
            : 'liked_profile_id';
        const idField = normalizedType === 'followers'
          ? 'follower_id'
          : normalizedType === 'following'
            ? 'followed_id'
            : 'liker_id';

        const { data: rows, error: rowsError } = await supabase
          .from(sourceTable)
          .select(idField)
          .eq(profileField, profileId)
          .limit(500);

        if (rowsError) {
          throw rowsError;
        }

        const ids = Array.from(new Set((rows || []).map((row) => row[idField]).filter(Boolean)));

        if (ids.length === 0) {
          if (!cancelled) {
            setItems([]);
            setLoading(false);
          }
          return;
        }

        let profilesQuery = supabase
          .from('profiles')
          .select('*');

        let profilesData = [];
        let profilesError = null;

        if (ids.length === 1) {
          const singleResult = await profilesQuery.eq('id', ids[0]).maybeSingle();
          profilesData = singleResult.data ? [singleResult.data] : [];
          profilesError = singleResult.error;
        } else {
          const multiResult = await profilesQuery.in('id', ids);
          profilesData = multiResult.data || [];
          profilesError = multiResult.error;
        }

        if (profilesError) {
          throw profilesError;
        }

        if (!cancelled) {
          // Resolve avatar storage paths to public URLs (non-HTTP paths)
          const resolved = (profilesData || []).map((p) => {
            let resolvedAvatar = null;
            try {
              if (p?.avatar_url) {
                if (/^https?:\/\//i.test(p.avatar_url)) {
                  resolvedAvatar = p.avatar_url;
                } else {
                  const { data: publicUrlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(p.avatar_url);
                  resolvedAvatar = publicUrlData?.publicUrl || null;
                }
              }
            } catch (e) {
              resolvedAvatar = null;
            }
            return { ...p, resolvedAvatar };
          });

          setItems(resolved);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load list.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchItems();
    return () => {
      cancelled = true;
      mounted = false;
    };
  }, [profileId, normalizedType]);

  // Check which of the fetched profiles are followed by current user
  useEffect(() => {
    if (!currentUserId || !items || items.length === 0) return;
    const ids = items.map((i) => i.id).filter(Boolean);
    if (ids.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const { data, error: qErr } = await supabase
          .from('follows')
          .select('followed_id')
          .eq('follower_id', currentUserId)
          .in('followed_id', ids);

        if (qErr) throw qErr;
        if (cancelled) return;

        const map = {};
        (data || []).forEach((r) => {
          if (r && r.followed_id) map[r.followed_id] = true;
        });
        setFollowMap(map);
      } catch (e) {
        // ignore
      }
    })();

    return () => { cancelled = true; };
  }, [currentUserId, items]);

  const toggleFollow = useCallback(async (targetId) => {
    if (!currentUserId) {
      // not logged in — do nothing for now
      return;
    }

    const isFollowing = !!followMap[targetId];

    // optimistic update
    setFollowMap((prev) => ({ ...prev, [targetId]: !isFollowing }));

    try {
      if (!isFollowing) {
        // insert follow
        const { error: insertErr } = await supabase.from('follows').insert([{ follower_id: currentUserId, followed_id: targetId }]);
        if (insertErr) throw insertErr;
      } else {
        // remove follow
        const { error: delErr } = await supabase.from('follows').delete().match({ follower_id: currentUserId, followed_id: targetId });
        if (delErr) throw delErr;
      }
    } catch (err) {
      // revert optimistic
      setFollowMap((prev) => ({ ...prev, [targetId]: isFollowing }));
    }
  }, [currentUserId, followMap]);



  const titleLabel = normalizedType === 'followers' ? 'Followers' : normalizedType === 'following' ? 'Following' : 'Likes';
  const titleCount = items.length;

  const openProfileInHome = useCallback((item) => {
    if (!item?.id) return;

    navigate('/home', {
      state: {
        highlightProfileId: item.id,
        highlightProfile: item,
      },
    });
  }, [navigate]);

  const handleListAction = (item) => {
    if (normalizedType === 'likes' || normalizedType === 'following') {
      openProfileInHome(item);
      return;
    }

    toggleFollow(item.id);
  };

  return (
    <div className="follow-like-page-shell">
      <div className="follow-like-page-header">
        <button
          type="button"
          className="settings-stp-back-btn follow-like-page-back"
          onClick={handleGoBack}
        >
          <FiChevronLeft />
          <span>Back</span>
        </button>
        <h1 className="settings-stp-page-title follow-like-page-title">
          <span className="follow-like-page-title-label">{titleLabel}</span>
          <span className="follow-like-page-title-count">{titleCount}</span>
        </h1>
        <div className="settings-stp-header-spacer" />
      </div>

      <div className="follow-like-page-content">
        <div className="follow-like-page-body">
          {loading && <div className="follow-like-modal-loading">Loading…</div>}
          {error && <div className="follow-like-modal-error">{error}</div>}
          {!loading && !error && items.length === 0 && (
            <div className="follow-like-modal-empty">No profiles found.</div>
          )}
          {!loading && !error && items.length > 0 && (
            <ul className="follow-like-modal-list">
              {items.map((item) => {
                const name = item.display_name || item.full_name || item.name || item.email || 'Unknown user';
                const subtitleText = item.title || item.email || '';

                return (
                  <li key={item.id} className="follow-like-modal-list-item">
                    <div
                      className="follow-like-modal-left"
                      role="button"
                      tabIndex={0}
                      onClick={() => openProfileInHome(item)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openProfileInHome(item)}
                    >
                      <div className="follow-like-modal-avatar">
                        {item.resolvedAvatar ? (
                          <>
                            <img
                              src={item.resolvedAvatar}
                              alt={name}
                              onError={(e) => {
                                try {
                                  e.target.style.display = 'none';
                                  const init = e.target.parentNode.querySelector('.follow-like-initial');
                                  if (init) init.style.display = 'grid';
                                } catch (err) {}
                              }}
                            />
                            <span className="follow-like-initial" style={{ display: 'none' }}>
                              {name.charAt(0).toUpperCase()}
                            </span>
                          </>
                        ) : (
                          <span className="follow-like-initial">{name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="follow-like-modal-item-text">
                        <span className="follow-like-modal-item-name">{name}</span>
                        {subtitleText && <span className="follow-like-modal-item-subtitle">{subtitleText}</span>}
                      </div>
                    </div>
                    <div>
                      <button
                        type="button"
                        className={`follow-like-action-btn ${normalizedType === 'likes' || normalizedType === 'following' ? 'follow' : (followMap[item.id] ? 'following' : 'follow')}`}
                        onClick={() => handleListAction(item)}
                      >
                        {normalizedType === 'likes' || normalizedType === 'following' ? 'View' : (followMap[item.id] ? 'Following' : 'Follow')}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default FollowLikeListPage;
