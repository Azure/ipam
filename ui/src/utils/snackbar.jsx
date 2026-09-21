import { enqueueSnackbar } from 'notistack'

const SnackbarUtils = {
  success(msg) {
    this.toast(msg, 'success');
  },
  warning(msg) {
    this.toast(msg, 'warning');
  },
  info(msg) {
    this.toast(msg, 'info');
  },
  error(msg) {
    this.toast(msg, 'error');
  },
  toast(msg, variant = 'default') {
    enqueueSnackbar(msg, { variant });
  }
}

export default SnackbarUtils;
