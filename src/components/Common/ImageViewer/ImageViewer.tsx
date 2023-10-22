import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions as RNDimensions, StyleSheet } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureStateChangeEvent,
  GestureUpdateEvent,
  PanGestureHandlerEventPayload,
  PinchGestureHandlerEventPayload,
} from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
} from 'react-native-reanimated';
import { useImageViewer } from '@components/Common/ImageViewer/ImageViewerProvider';
import { getImageRatio } from '@helpers/image/getRatio';
import { View, YStack } from 'tamagui';
import { Image } from 'expo-image';
import ImageViewerHeader from '@components/Common/ImageViewer/ImageViewerHeader';
import ImageViewerFooter from '@components/Common/ImageViewer/ImageViewerFooter';
import AppToast from '@components/Common/Toast/AppToast';

const AnimatedImage = Animated.createAnimatedComponent(Image);

// interface MeasureResult {
//   x: number;
//   y: number;
//   width: number;
//   height: number;
//   px: number;
//   py: number;
// }

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } =
  RNDimensions.get('screen');

const MAX_SCALE = 3;

function ImageViewer(): React.JSX.Element {
  const imageViewer = useImageViewer();

  const [accessoriesVisible, setAccessoriesVisible] = useState(true);

  const viewerDims = useMemo(() => {
    return getImageRatio(
      imageViewer.dimensions.height,
      imageViewer.dimensions.width,
    );
  }, [imageViewer.dimensions]);

  const zoomScale = useSharedValue(1);
  const lastScale = useSharedValue(1);

  const backgroundColor = useSharedValue('rgba(0,0,0,0)');

  const positionX = useSharedValue(0);
  const positionY = useSharedValue(0);

  const lastTranslateX = useSharedValue(0);
  const lastTranslateY = useSharedValue(0);

  // const height = useSharedValue(0);
  // const width = useSharedValue(0);

  const lastTap = useSharedValue(Date.now());

  // Calculate where we should position the image for it to be centered
  const centerX = useMemo(
    () => SCREEN_WIDTH / 2 - viewerDims.width / 2,
    [viewerDims],
  );
  const centerY = useMemo(
    () => SCREEN_HEIGHT / 2 - viewerDims.height / 2,
    [viewerDims],
  );

  // const initialPos = useSharedValue<MeasureResult>({
  //   x: 0,
  //   y: 0,
  //   height: 0,
  //   width: 0,
  //   py: 0,
  //   px: 0,
  // });

  const onRequestOpenOrClose = useCallback((): void => {
    if (imageViewer.setVisible == null) return;

    if (imageViewer.visible) {
      imageViewer.setVisible(false);
    }
  }, [imageViewer.visible]);

  // This takes care of moving the image to the center whenever open the image
  // or whenever we want to reset the impage position
  const centerImage = useCallback((): void => {
    'worklet';

    positionX.value = withTiming(centerX, { duration: 200 });
    positionY.value = withTiming(centerY, { duration: 200 });
    backgroundColor.value = withTiming('rgba(0,0,0,1)', { duration: 200 });
  }, []);

  // Animated position style
  const positionStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: positionX.value },
      { translateY: positionY.value },
    ],
  }));

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: zoomScale.value }],
  }));

  const backgroundStyle = useAnimatedStyle(() => ({
    backgroundColor: backgroundColor.value,
  }));

  const onSingleTap = useCallback(() => {
    cancelAnimation(positionX);
    cancelAnimation(positionY);

    if (zoomScale.value === 1 && lastTap.value + 200 < Date.now()) {
      setAccessoriesVisible((prev) => !prev);
    }

    lastTap.value = Date.now();
  }, []);

  const singleTapGesture = useMemo(
    () => Gesture.Tap().onStart(onSingleTap),
    [],
  );

  // <editor-fold desc="Double Tap Zomo">
  const onDoubleTap = useCallback((): void => {
    'worklet';

    runOnJS(setAccessoriesVisible)(false);

    // If the image is already zoomed, let's just reset it
    if (zoomScale.value !== 1) {
      centerImage();
      zoomScale.value = withTiming(1, { duration: 200 });
      lastScale.value = 1;
      return;
    }

    // Zoom to the max scale
    zoomScale.value = withTiming(1.75, { duration: 200 });
    lastScale.value = 1.75;
  }, []);

  // Create the double tap gesture
  const doubleTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDelay(200)
        .maxDuration(200)
        .onEnd(onDoubleTap),
    [],
  );

  // </editor-fold>

  // <editor-fold desc="Pan Gestures">

  const onPanBegin = useCallback((): void => {
    'worklet';

    // We need to reset everything first
    lastTranslateX.value = 0;
    lastTranslateY.value = 0;

    // Later we will hide whatever accessories we might be displaying
  }, []);

  const onPanUpdate = useCallback(
    (event: GestureUpdateEvent<PanGestureHandlerEventPayload>): void => {
      'worklet';

      // Move the image
      positionX.value += event.translationX - lastTranslateX.value;
      positionY.value += event.translationY - lastTranslateY.value;

      // Save the last translation
      lastTranslateX.value = event.translationX;
      lastTranslateY.value = event.translationY;
    },
    [],
  );

  const onPanEnd = useCallback(
    (event: GestureStateChangeEvent<PanGestureHandlerEventPayload>): void => {
      'worklet';

      // First see what the velocity is. If it's above the max velocity, and it is
      // in a vertical direction, we should close the image viewer

      // First create an absolute value
      const velocity = Math.abs(event.velocityY);
      const translationX = Math.abs(event.translationX);

      if (velocity > 800 && zoomScale.value <= 1 && translationX < 75) {
        runOnJS(onRequestOpenOrClose)();

        return;
      }

      // We should recenter the image after the pan if we are not zoomed in
      if (zoomScale.value <= 1) {
        centerImage();
        return;
      }

      // Gradually decrease momentum
      positionX.value = withDecay({
        velocity: event.velocityX / 1.2,
      });
      positionY.value = withDecay({
        velocity: event.velocityY / 1.2,
      });
    },
    [],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(2)
        .onBegin(onPanBegin)
        .onUpdate(onPanUpdate)
        .onEnd(onPanEnd),
    [],
  );

  // </editor-fold>

  // <editor-fold desc="Pinch Gestures">

  const onPinchStart = useCallback((): void => {
    'worklet';

    // We should just hide the accessories. Later
  }, []);

  const onPinchUpdate = useCallback(
    (event: GestureUpdateEvent<PinchGestureHandlerEventPayload>): void => {
      'worklet';

      // Simply increase the zoom scale
      zoomScale.value = lastScale.value * event.scale;
    },
    [],
  );

  const onPinchEnd = useCallback((): void => {
    'worklet';

    // If we have zoomed out past a scale of one, we should just reset the image
    if (zoomScale.value <= 1) {
      zoomScale.value = withTiming(1, { duration: 200 });
      centerImage();

      lastScale.value = 1;

      return;
    }

    // Don't let the user zoom in too much
    if (zoomScale.value > MAX_SCALE) {
      zoomScale.value = withTiming(MAX_SCALE, { duration: 200 });

      lastScale.value = MAX_SCALE;

      return;
    }

    // Save the last scale
    lastScale.value = zoomScale.value;
  }, []);

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(onPinchStart)
        .onUpdate(onPinchUpdate)
        .onEnd(onPinchEnd),
    [],
  );

  // </editor-fold>

  // Create our joined gestures
  const panAndPinchGestures = Gesture.Simultaneous(panGesture, pinchGesture);
  const tapGestures = Gesture.Simultaneous(singleTapGesture, doubleTapGesture);
  const allGestures = Gesture.Exclusive(panAndPinchGestures, tapGestures);

  useEffect(() => {
    if (imageViewer.visible) {
      centerImage();
    }
  }, [imageViewer.visible]);

  return (
    <View flex={1}>
      <AppToast />
      <ImageViewerHeader visible={accessoriesVisible} />
      <GestureDetector gesture={allGestures}>
        <YStack zIndex={-1} flex={1}>
          <Animated.View style={[styles.imageModal, backgroundStyle]}>
            <Animated.View style={[positionStyle]}>
              <AnimatedImage
                source={{ uri: imageViewer.params?.source }}
                style={[viewerDims, scaleStyle]}
                enableLiveTextInteraction
              />
            </Animated.View>
          </Animated.View>
        </YStack>
      </GestureDetector>

      <ImageViewerFooter visible={accessoriesVisible} />
    </View>
  );
}

const styles = StyleSheet.create({
  imageModal: {
    flex: 1,
  },

  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default React.memo(ImageViewer);
