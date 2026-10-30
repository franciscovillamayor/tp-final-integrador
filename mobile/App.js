// aplicacion movil seriescore en react native expo

import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
  StyleSheet,
  StatusBar,
  Dimensions,
} from 'react-native';

const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
const { width } = Dimensions.get('window');

export default function App() {
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'diary' | 'lists' | 'profile'
  const [catalog, setCatalog] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTitle, setSelectedTitle] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [user, setUser] = useState({ name: 'Usuario Demo', role: 'Usuario', token: null });
  const [diary, setDiary] = useState([]);
  const [lists, setLists] = useState([]);
  const [newReviewText, setNewReviewText] = useState('');

  // cargar catalogo desde el backend
  const loadCatalog = async () => {
    try {
      const q = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : '';
      const res = await fetch(`${API}/catalog${q}`);
      const data = await res.json();
      setCatalog(Array.isArray(data) ? data : []);
    } catch {
      setCatalog([]);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, [searchQuery]);

  // abrir ficha detallada con seriesgraph
  const openDetail = async id => {
    try {
      const res = await fetch(`${API}/catalog/${id}`);
      const data = await res.json();
      setSelectedTitle(data);
      setDetailModalVisible(true);
    } catch {}
  };

  // calificar titulo con estrellas
  const rateTitle = async score => {
    if (!selectedTitle) return;
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (user.token) headers.Authorization = `Bearer ${user.token}`;
      await fetch(`${API}/ratings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ titleId: selectedTitle.id, score }),
      });
      openDetail(selectedTitle.id);
    } catch {}
  };

  // agregar a lista quiero ver
  const addToList = async () => {
    if (!selectedTitle) return;
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (user.token) headers.Authorization = `Bearer ${user.token}`;
      const listsRes = await fetch(`${API}/lists`, { headers });
      const userLists = await listsRes.json();
      const target = userLists[0] || { id: 1 };
      await fetch(`${API}/lists/${target.id}/items`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ titleId: selectedTitle.id }),
      });
      alert(`Guardado en "${target.nombre || 'Quiero ver'}"`);
    } catch {}
  };

  // agregar a diario
  const addToDiary = async () => {
    if (!selectedTitle) return;
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (user.token) headers.Authorization = `Bearer ${user.token}`;
      await fetch(`${API}/diary`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          titleId: selectedTitle.id,
          watchedAt: new Date().toISOString().slice(0, 10),
          score: 5,
        }),
      });
      alert('Registrado en tu diario con éxito');
    } catch {}
  };

  // publicar resena
  const submitReview = async () => {
    if (!newReviewText.trim() || !selectedTitle) return;
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (user.token) headers.Authorization = `Bearer ${user.token}`;
      await fetch(`${API}/reviews`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ titleId: selectedTitle.id, body: newReviewText.trim() }),
      });
      setNewReviewText('');
      openDetail(selectedTitle.id);
    } catch {}
  };

  // login demo por rol
  const loginAs = async email => {
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Seriescore1' }),
      });
      const data = await res.json();
      if (data.user) {
        setUser({ name: data.user.name, role: data.user.role, token: data.accessToken });
      }
    } catch {}
  };

  // filtrado en catalogo
  const filteredCatalog = catalog.filter(item => {
    if (filterType === 'tv') return item.type === 'tv';
    if (filterType === 'movie') return item.type === 'movie';
    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#090d16" />

      {/* barra superior con branding */}
      <View style={styles.topBar}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoBadgeText}>S</Text>
        </View>
        <Text style={styles.logoTitle}>SERIESCORE</Text>
        <View style={styles.userBadge}>
          <Text style={styles.userRoleText}>{user.role.toUpperCase()}</Text>
        </View>
      </View>

      {/* contenido segun tab activa */}
      {activeTab === 'catalog' && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchSection}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar películas o series..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <View style={styles.filterPills}>
              <TouchableOpacity
                style={[styles.pill, filterType === 'all' && styles.pillActive]}
                onPress={() => setFilterType('all')}
              >
                <Text style={[styles.pillText, filterType === 'all' && styles.pillTextActive]}>Todos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pill, filterType === 'tv' && styles.pillActive]}
                onPress={() => setFilterType('tv')}
              >
                <Text style={[styles.pillText, filterType === 'tv' && styles.pillTextActive]}>Series</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pill, filterType === 'movie' && styles.pillActive]}
                onPress={() => setFilterType('movie')}
              >
                <Text style={[styles.pillText, filterType === 'movie' && styles.pillTextActive]}>Películas</Text>
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            data={filteredCatalog}
            numColumns={2}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={styles.catalogGrid}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.posterCard} onPress={() => openDetail(item.id)}>
                <View style={styles.posterWrapper}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.posterImg} />
                  ) : (
                    <View style={styles.posterFallback}>
                      <Text style={styles.fallbackLetter}>{item.title?.[0]}</Text>
                    </View>
                  )}
                  <View style={styles.posterScoreBadge}>
                    <Text style={styles.scoreText}>★ {Number(item.vote_average || 0).toFixed(1)}</Text>
                  </View>
                  <View style={styles.typeTag}>
                    <Text style={styles.typeTagText}>{item.type === 'tv' ? 'SERIE' : 'PELI'}</Text>
                  </View>
                </View>
                <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSub}>{item.year || '—'}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No se encontraron títulos en el catálogo.</Text>
            }
          />
        </View>
      )}

      {activeTab === 'profile' && (
        <ScrollView style={styles.profileContainer}>
          <View style={styles.profileCard}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>{user.name[0]}</Text>
            </View>
            <Text style={styles.userNameText}>{user.name}</Text>
            <Text style={styles.userRoleBadge}>{user.role}</Text>
          </View>

          <View style={styles.demoSection}>
            <Text style={styles.demoTitle}>Cambiar de cuenta (Demo Roles):</Text>
            <TouchableOpacity
              style={[styles.demoBtn, { borderColor: '#ec4899' }]}
              onPress={() => loginAs('admin@seriescore.local')}
            >
              <Text style={styles.demoBtnText}>Iniciar como Administrador</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.demoBtn, { borderColor: '#22d3ee' }]}
              onPress={() => loginAs('moderador@seriescore.local')}
            >
              <Text style={styles.demoBtnText}>Iniciar como Moderador</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.demoBtn, { borderColor: '#a855f7' }]}
              onPress={() => loginAs('usuario@seriescore.local')}
            >
              <Text style={styles.demoBtnText}>Iniciar como Usuario</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* modal de ficha detallada con seriesgraph */}
      <Modal visible={detailModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setDetailModalVisible(false)}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>

            {selectedTitle && (
              <ScrollView contentContainerStyle={styles.detailScroll}>
                <View style={styles.detailHero}>
                  {selectedTitle.image && (
                    <Image source={{ uri: selectedTitle.image }} style={styles.detailPoster} />
                  )}
                  <View style={styles.detailMeta}>
                    <Text style={styles.detailBadge}>
                      {selectedTitle.type === 'tv' ? 'SERIE DE TV' : 'PELÍCULA'}
                    </Text>
                    <Text style={styles.detailTitle}>{selectedTitle.title}</Text>
                    <Text style={styles.detailScore}>
                      ★ {Number(selectedTitle.vote_average || 0).toFixed(1)} TMDB · {selectedTitle.year || '—'}
                    </Text>

                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.actionBtnSmall} onPress={addToDiary}>
                        <Text style={styles.actionBtnText}>Diario</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtnSmall} onPress={addToList}>
                        <Text style={styles.actionBtnText}>Lista</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* selector de estrellas de calificacion */}
                <View style={styles.starSection}>
                  <Text style={styles.sectionSubtitle}>Tu calificación:</Text>
                  <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <TouchableOpacity key={s} onPress={() => rateTitle(s)}>
                        <Text style={styles.starIcon}>★</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* sinopsis */}
                <Text style={styles.sectionSubtitle}>Sinopsis</Text>
                <Text style={styles.overviewText}>{selectedTitle.overview || 'Sin descripción.'}</Text>

                {/* grafico seriesgraph para series */}
                {selectedTitle.type === 'tv' && selectedTitle.episodes?.length > 0 && (
                  <View style={styles.seriesGraphBox}>
                    <Text style={styles.sectionSubtitle}>SeriesGraph · Evolución Episódica</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.graphScroll}>
                      {selectedTitle.episodes.map((ep, i) => {
                        const score = Number(ep.nota_tmdb || 7);
                        const barHeight = Math.max(15, (score - 5) * 16);
                        return (
                          <View key={i} style={styles.graphBarCol}>
                            <Text style={styles.barScoreText}>{score.toFixed(1)}</Text>
                            <View style={[styles.graphBar, { height: barHeight }]} />
                            <Text style={styles.barLabel}>E{ep.numero}</Text>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* resenas comunitarias */}
                <Text style={[styles.sectionSubtitle, { marginTop: 24 }]}>
                  Reseñas ({selectedTitle.reviews?.length || 0})
                </Text>
                <View style={styles.reviewInputBox}>
                  <TextInput
                    style={styles.reviewInput}
                    placeholder="Escribí tu opinión..."
                    placeholderTextColor="#94a3b8"
                    value={newReviewText}
                    onChangeText={setNewReviewText}
                  />
                  <TouchableOpacity style={styles.reviewSendBtn} onPress={submitReview}>
                    <Text style={styles.reviewSendText}>Publicar</Text>
                  </TouchableOpacity>
                </View>

                {(selectedTitle.reviews || []).map((rev, i) => (
                  <View key={i} style={styles.reviewCard}>
                    <Text style={styles.reviewAuthor}>{rev.autor || 'Usuario'}</Text>
                    <Text style={styles.reviewBody}>{rev.texto}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* barra de navegacion inferior */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'catalog' && styles.navItemActive]}
          onPress={() => setActiveTab('catalog')}
        >
          <Text style={[styles.navLabel, activeTab === 'catalog' && styles.navLabelActive]}>Catálogo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === 'profile' && styles.navItemActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.navLabel, activeTab === 'profile' && styles.navLabelActive]}>Perfil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ec4899',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoBadgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },
  logoTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
    flex: 1,
  },
  userBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(34,211,238,0.15)',
  },
  userRoleText: {
    color: '#22d3ee',
    fontSize: 10,
    fontWeight: '800',
  },
  searchSection: {
    padding: 16,
    gap: 12,
  },
  searchInput: {
    backgroundColor: '#111827',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterPills: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pillActive: {
    backgroundColor: '#ec4899',
    borderColor: '#ec4899',
  },
  pillText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  pillTextActive: {
    color: '#fff',
  },
  catalogGrid: {
    paddingHorizontal: 10,
    paddingBottom: 90,
  },
  posterCard: {
    flex: 1,
    margin: 6,
    maxWidth: (width - 32) / 2,
  },
  posterWrapper: {
    aspectRatio: 2 / 3,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
    position: 'relative',
  },
  posterImg: {
    width: '100%',
    height: '100%',
  },
  posterFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackLetter: {
    fontSize: 48,
    color: '#22d3ee',
    fontWeight: '900',
  },
  posterScoreBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(9,13,22,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  scoreText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '800',
  },
  typeTag: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(9,13,22,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeTagText: {
    color: '#22d3ee',
    fontSize: 9,
    fontWeight: '800',
  },
  cardTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    marginTop: 6,
  },
  cardSub: {
    color: '#94a3b8',
    fontSize: 11,
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 40,
  },
  bottomNav: {
    flexDirection: 'row',
    height: 64,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#090d16',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  navItem: {
    alignItems: 'center',
  },
  navItemActive: {
    transform: [{ scale: 1.05 }],
  },
  navIcon: {
    fontSize: 20,
    opacity: 0.6,
  },
  navIconActive: {
    opacity: 1,
  },
  navLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#22d3ee',
  },
  profileContainer: {
    padding: 20,
  },
  profileCard: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#22d3ee',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarLargeText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#090d16',
  },
  userNameText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  userRoleBadge: {
    color: '#22d3ee',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  demoSection: {
    marginTop: 24,
    gap: 10,
  },
  demoTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  demoBtn: {
    padding: 14,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  demoBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    height: '88%',
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalCloseBtn: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  modalCloseText: {
    color: '#94a3b8',
    fontSize: 18,
    fontWeight: '800',
  },
  detailScroll: {
    paddingBottom: 40,
  },
  detailHero: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  detailPoster: {
    width: 110,
    height: 165,
    borderRadius: 10,
  },
  detailMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  detailBadge: {
    color: '#ec4899',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  detailTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    marginVertical: 4,
  },
  detailScore: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnSmall: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionBtnText: {
    color: '#22d3ee',
    fontSize: 11,
    fontWeight: '700',
  },
  starSection: {
    marginVertical: 14,
  },
  starRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  starIcon: {
    color: '#fbbf24',
    fontSize: 28,
  },
  sectionSubtitle: {
    color: '#22d3ee',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  overviewText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 20,
  },
  seriesGraphBox: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#111827',
    borderRadius: 12,
  },
  graphScroll: {
    marginTop: 10,
  },
  graphBarCol: {
    alignItems: 'center',
    marginRight: 14,
    justifyContent: 'flex-end',
    height: 110,
  },
  barScoreText: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  graphBar: {
    width: 14,
    backgroundColor: '#22d3ee',
    borderRadius: 4,
  },
  barLabel: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 6,
  },
  reviewInputBox: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  reviewInput: {
    flex: 1,
    backgroundColor: '#111827',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  reviewSendBtn: {
    backgroundColor: '#ec4899',
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
  },
  reviewSendText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  reviewCard: {
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  reviewAuthor: {
    color: '#22d3ee',
    fontWeight: '800',
    fontSize: 12,
    marginBottom: 4,
  },
  reviewBody: {
    color: '#cbd5e1',
    fontSize: 13,
  },
});
