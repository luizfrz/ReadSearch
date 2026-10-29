import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MARKER_COLORS } from '../highlights';
import { colors } from '../theme';

// Ferramentas de leitura, no lado esquerdo: o ícone de ferramenta abre/fecha o painel.
export default function ReaderTools({ can, state, on }) {
  const [open, setOpen] = useState(false);

  const tool = (icon, label, onPress, active, tint) => (
    <Pressable key={label} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.accent : colors.card2, borderWidth: 1, borderColor: colors.border }}>
        <Ionicons name={icon} size={20} color={tint || '#fff'} />
      </View>
      <View style={{ marginLeft: 8, backgroundColor: 'rgba(5,13,36,0.85)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
        <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      </View>
    </Pressable>
  );

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 12, bottom: 70 }}>
      {open ? (
        <View>
          {can.print ? tool('camera', 'Tirar print', on.print) : null}
          {can.mark ? tool(state.pageMarked ? 'bookmark' : 'bookmark-outline', state.pageMarked ? 'Desmarcar página' : 'Marcar página', on.mark, state.pageMarked, '#ffd166') : null}
          {can.color ? (
            <View>
              {tool('brush', 'Destacar texto', on.toggleColor, state.colorOn)}
              {state.colorOn ? (
                <View style={{ flexDirection: 'row', marginLeft: 6, marginBottom: 10 }}>
                  {MARKER_COLORS.map((c) => (
                    <Pressable key={c} onPress={() => on.pickColor(c)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.slice(0, 7), marginRight: 8, borderWidth: state.color === c ? 3 : 1, borderColor: '#fff' }} />
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
          {can.notes ? tool('create-outline', 'Notas e marcadores', on.notes) : null}
        </View>
      ) : null}
      <Pressable
        onPress={() => setOpen(!open)}
        style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: open ? colors.accent : colors.card, borderWidth: 1, borderColor: colors.accent, elevation: 6 }}
      >
        <Ionicons name={open ? 'close' : 'construct'} size={22} color="#fff" />
      </Pressable>
    </View>
  );
}
